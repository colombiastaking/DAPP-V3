import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Address,
  Query,
  ContractFunction,
  AddressValue,
  decodeBigNumber
} from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { network } from 'config';
import { useGlobalContext } from 'context';
import { fetchWithBackup } from '../utils/resilientApi';

const PEERME_COLS_CONTRACT =
  'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const PEERME_ENTITY_ADDRESS =
  'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0';


const AGENCY_BUYBACK = 0.30;
const DAO_DISTRIBUTION_RATIO = 0.333;
const BONUS_BUYBACK_FACTOR = 0.66;

const PRIMARY_PROVIDER_API = `https://staking.colombia-staking.com/mvx-api/providers/${network.delegationContract}`;
const BACKUP_PROVIDER_API = `https://api.multiversx.com/providers/${network.delegationContract}`;

export interface ColsStakerRow {
  address: string;
  colsStaked: number;
  egldStaked: number;
  ratio: number | null;
  normalized: number | null;
  aprBonus: number | null;
  dao: number | null;
  aprTotal: number | null;
  rank: number | null;
  aprColsOnly?: number | null;
}

// wait helper
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/** --- Fetch COLS price with backup API --- */
async function fetchColsPriceFromApi() {
  const primary =
    'https://api.multiversx.com/mex/tokens/prices/hourly/COLS-9d91b7';
  const backup =
    'https://staking.colombia-staking.com/mvx-api/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7';

  const data = await fetchWithBackup<any>(primary, backup);
  if (!data) return 0;

  if (Array.isArray(data) && data.length > 0) {
    const last = data[data.length - 1];
    if (last && typeof last.value === 'number') {
      return Math.round(last.value * 1000) / 1000;
    }
  }
  if (Array.isArray(data) && typeof data[0]?.price === 'number') {
    return Math.round(data[0].price * 1000) / 1000;
  }
  return 0;
}

async function fetchBaseAprFromApi() {
  const data = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  return data && typeof data.apr === 'number' ? data.apr : 0;
}

async function fetchAgencyLockedEgld() {
  const data = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  if (data?.locked) {
    return Math.round((Number(data.locked) / 1e18) * 10000) / 10000;
  }
  return 0;
}

async function fetchEgldPrice() {
  try {
    const { data } = await axios.get(`${network.apiAddress}/economics`);
    return Number(data.price);
  } catch {
    return 0;
  }
}

/** --- Contract-based staking fetch (always correct) --- */
async function fetchStakeWithRetry(addr: string, retries = 5, delayMs = 1500) {
  const provider = new ProxyNetworkProvider(network.gatewayAddress);
  for (let i = 0; i < retries; i++) {
    try {
      const query = new Query({
        address: new Address(network.delegationContract),
        func: new ContractFunction('getUserActiveStake'),
        args: [new AddressValue(new Address(addr))]
      });
      const data = await provider.queryContract(query);
      const [stake] = data.getReturnDataParts();
      return stake ? Number(decodeBigNumber(stake).toFixed()) / 1e18 : 0;
    } catch {
      await wait(delayMs * (i + 1));
    }
  }
  return 0;
}

/** --- Always use backup (contract query) to get correct eGLD staked --- */
async function fetchEgldStakedMap(addresses: string[]): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  const results = await Promise.allSettled(addresses.map(addr => fetchStakeWithRetry(addr)));
  results.forEach((res, idx) => {
    const addr = addresses[idx];
    map[addr] = res.status === 'fulfilled' ? res.value : 0;
  });
  return map;
}

function calculateColsOnlyApr({
  sumColsStaked,
  baseApr,
  serviceFee,
  agencyLockedEgld,
  egldPrice,
  colsPrice
}: any) {
  if (!sumColsStaked || !baseApr || !agencyLockedEgld || !egldPrice || !colsPrice)
    return 0;

  const baseAprCorrected = baseApr / (1 - serviceFee) / 100;
  const numerator =
    agencyLockedEgld *
    baseAprCorrected *
    AGENCY_BUYBACK *
    serviceFee *
    DAO_DISTRIBUTION_RATIO *
    egldPrice;

  const denominator = colsPrice * sumColsStaked;
  if (denominator === 0) return 0;

  return (numerator / denominator) * 100;
}

export function useColsApr({ trigger }: { trigger: any }) {
  const [loading, setLoading] = useState(true);
  const [stakers, setStakers] = useState<ColsStakerRow[]>([]);
  const [egldPrice, setEgldPrice] = useState<number>(0);
  const [colsPrice, setColsPrice] = useState<number>(0);
  const [baseApr, setBaseApr] = useState<number>(0);
  const [agencyLockedEgld, setAgencyLockedEgld] = useState<number>(0);
  const [aprMax, setAprMax] = useState<number>(15);
  const [targetAvgAprBonus, setTargetAvgAprBonus] = useState<number>(0);

  const { contractDetails } = useGlobalContext();

  /** --- Fetch list of COLS stakers --- */
  const fetchColsStakers = useCallback(async () => {
    const provider = new ProxyNetworkProvider(network.gatewayAddress);
    const query = new Query({
      address: new Address(PEERME_COLS_CONTRACT),
      func: new ContractFunction('getEntityUsers'),
      args: [new AddressValue(new Address(PEERME_ENTITY_ADDRESS))]
    });
    const data = await provider.queryContract(query);
    const parts = data.getReturnDataParts();
    const result: { address: string; colsStaked: number }[] = [];

    for (let i = 0; i < parts.length; i += 2) {
      const addr = new Address(parts[i]).bech32();
      const amt = decodeBigNumber(parts[i + 1]).toFixed();
      result.push({ address: addr, colsStaked: Number(amt) / 1e18 });
    }
    return result;
  }, []);

  /** --- Full APR recalculation --- */
  const recalc = useCallback(async () => {
    setLoading(true);
    try {
      const [
        colsStakers,
        fetchedEgldPrice,
        fetchedColsPrice,
        fetchedBaseApr,
        lockedEgld
      ] = await Promise.all([
        fetchColsStakers(),
        fetchEgldPrice(),
        fetchColsPriceFromApi(),
        fetchBaseAprFromApi(),
        fetchAgencyLockedEgld()
      ]);

      setEgldPrice(fetchedEgldPrice);
      setColsPrice(fetchedColsPrice);
      setBaseApr(fetchedBaseApr);
      setAgencyLockedEgld(lockedEgld);

      /** --- Always use correct backup API for staking --- */
      const addresses = colsStakers.map(s => s.address);
      const egldStakedMap = await fetchEgldStakedMap(addresses);

      let serviceFee = 0.10;
      if (contractDetails?.data?.serviceFee) {
        const feeNum = parseFloat(contractDetails.data.serviceFee.replace('%', '').trim());
        if (!isNaN(feeNum)) serviceFee = feeNum / 100;
      }

      /** --- Build main staker table --- */
      const table: ColsStakerRow[] = colsStakers.map(s => ({
        address: s.address,
        colsStaked: s.colsStaked,
        egldStaked: egldStakedMap[s.address] || 0,
        ratio: null,
        normalized: null,
        aprBonus: null,
        dao: null,
        aprTotal: null,
        rank: null,
        aprColsOnly: null
      }));

      /** --- Continue with same APR logic --- */
      const targetAvg =
        (lockedEgld *
          fetchedBaseApr /
          (1 - serviceFee) /
          100 *
          serviceFee *
          AGENCY_BUYBACK *
          BONUS_BUYBACK_FACTOR *
          fetchedEgldPrice) /
        fetchedColsPrice /
        365;

      setTargetAvgAprBonus(targetAvg);

      /** --- APR bonus solver --- */
      const aprMin = 0.3;
      let left = aprMin, right = 50, bestAprMax = 15;

      const calcSum = (aprMax: number) => {
        const filtered = table.filter(r => r.colsStaked > 0 && r.egldStaked > 0);
        if (!filtered.length) return 0;

        let minRatio = Infinity, maxRatio = -Infinity;
        filtered.forEach(r => {
          r.ratio =
            (r.colsStaked * fetchedColsPrice) /
            (r.egldStaked * fetchedEgldPrice);
          if (r.ratio < minRatio) minRatio = r.ratio;
          if (r.ratio > maxRatio) maxRatio = r.ratio;
        });

        filtered.forEach(r => {
          r.normalized =
            maxRatio !== minRatio && r.ratio !== null
              ? (r.ratio - minRatio) / (maxRatio - minRatio)
              : 0;

          r.aprBonus =
            aprMin + (aprMax - aprMin) * Math.sqrt(r.normalized as number);
        });

        return filtered.reduce((sum, r) => {
          const dist =
            r.aprBonus !== null
              ? ((r.aprBonus / 100) *
                  r.egldStaked *
                  fetchedEgldPrice) /
                365 /
                fetchedColsPrice
              : 0;
          return sum + dist;
        }, 0);
      };

      for (let iter = 0; iter < 30; iter++) {
        const mid = (left + right) / 2;
        const sum = calcSum(mid);
        if (Math.abs(sum - targetAvg) < 0.01) {
          bestAprMax = mid;
          break;
        }
        if (sum < targetAvg) left = mid;
        else right = mid;
        bestAprMax = mid;
      }
      setAprMax(bestAprMax);

      /** --- Final APR details --- */
      const validRatios = table
        .filter(r => r.egldStaked > 0 && r.colsStaked > 0)
        .map(r => {
          r.ratio =
            (r.colsStaked * fetchedColsPrice) /
            (r.egldStaked * fetchedEgldPrice);
          return r.ratio!;
        });

      const minRatio = validRatios.length ? Math.min(...validRatios) : 0;
      const maxRatio = validRatios.length ? Math.max(...validRatios) : 0;

      table.forEach(r => {
        r.normalized =
          r.ratio !== null && maxRatio !== minRatio
            ? (r.ratio - minRatio) / (maxRatio - minRatio)
            : null;

        r.aprBonus =
          r.normalized !== null
            ? aprMin + (bestAprMax - aprMin) * Math.sqrt(r.normalized as number)
            : null;
      });

      const sumCols = table.reduce((sum, r) => sum + (r.colsStaked || 0), 0);
      const baseAprCorrected = fetchedBaseApr / (1 - serviceFee) / 100;

      table.forEach(r => {
        if (r.egldStaked > 0 && r.colsStaked > 0 && sumCols > 0) {
          r.dao =
            ((lockedEgld *
              baseAprCorrected *
              AGENCY_BUYBACK *
              serviceFee *
              DAO_DISTRIBUTION_RATIO *
              r.colsStaked) /
              sumCols /
              r.egldStaked) *
            100;
        } else {
          r.dao = null;
        }
      });

      table.forEach(r => {
        if (r.colsStaked > 0) {
          r.aprColsOnly = calculateColsOnlyApr({
            sumColsStaked: sumCols,
            baseApr: fetchedBaseApr,
            serviceFee,
            agencyLockedEgld: lockedEgld,
            egldPrice: fetchedEgldPrice,
            colsPrice: fetchedColsPrice
          });
        } else r.aprColsOnly = null;
      });

      table.forEach(r => {
        if (r.egldStaked > 0)
          r.aprTotal = fetchedBaseApr + (r.aprBonus || 0) + (r.dao || 0);
        else if (r.colsStaked > 0)
          r.aprTotal = r.aprColsOnly ?? fetchedBaseApr;
        else r.aprTotal = fetchedBaseApr;
      });

      const sorted = [...table].sort(
        (a, b) => (b.aprTotal || 0) - (a.aprTotal || 0)
      );

      const rankMap = new Map(sorted.map((r, i) => [r.address, i + 1]));
      table.forEach(r => (r.rank = rankMap.get(r.address) ?? null));

      setStakers(table);
    } catch (err) {
      console.error('useColsApr recalculation failed', err);
      setStakers([]);
    } finally {
      setLoading(false);
    }
  }, [fetchColsStakers, contractDetails]);

  useEffect(() => {
    recalc();
  }, [trigger, recalc]);

  return {
    loading,
    stakers,
    egldPrice,
    colsPrice,
    baseApr,
    agencyLockedEgld,
    aprMax,
    targetAvgAprBonus,
    recalc
  };
}
