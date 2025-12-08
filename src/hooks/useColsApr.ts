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

/* ───────────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────────────────*/
const PEERME_COLS_CONTRACT =
  'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const PEERME_ENTITY_ADDRESS =
  'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0';

const AGENCY_BUYBACK = 0.30;
const DAO_DISTRIBUTION_RATIO = 0.333;
const BONUS_BUYBACK_FACTOR = 0.66;

const PRIMARY_PROVIDER_API = `https://staking.colombia-staking.com/mvx-api/providers/${network.delegationContract}`;
const PRIMARY_PROVIDER_ACCOUNTS = `${PRIMARY_PROVIDER_API}/accounts?size=10000`;

const BACKUP_PROVIDER_API = `https://api.multiversx.com/providers/${network.delegationContract}`;
const BACKUP_ACCOUNTS_API = `https://api.multiversx.com/providers/${network.delegationContract}/accounts?size=10000`;

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

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/*───────────────────────────────────────────────
  API — PRICE / ECONOMICS
─────────────────────────────────────────────────*/
async function fetchColsPriceFromApi() {
  const primary = 'https://api.multiversx.com/mex/tokens/prices/hourly/COLS-9d91b7';
  const backup =
    'https://staking.colombia-staking.com/mvx-api/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7';

  const data = await fetchWithBackup<any>(primary, backup);
  if (!data) return 0;

  if (Array.isArray(data) && data.length > 0 && typeof data[data.length - 1].value === 'number')
    return +(data[data.length - 1].value.toFixed(3));

  if (Array.isArray(data) && typeof data[0]?.price === 'number')
    return +(data[0].price.toFixed(3));

  return 0;
}

async function fetchBaseAprFromApi() {
  const d = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  return d?.apr ?? 0;
}

async function fetchAgencyLockedEgld() {
  const d = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  return d?.locked ? +(Number(d.locked)/1e18).toFixed(4) : 0;
}

async function fetchEgldPrice() {
  try {
    const { data } = await axios.get(`${network.apiAddress}/economics`);
    return Number(data.price);
  } catch {
    return 0;
  }
}

/*───────────────────────────────────────────────
  🥇 New Primary Fetch (FAST — 10000 accounts)
─────────────────────────────────────────────────*/
async function fetchEgldBulkPrimary(): Promise<Record<string,number>> {
  try {
    const r = await fetchWithBackup<any>(PRIMARY_PROVIDER_ACCOUNTS, BACKUP_ACCOUNTS_API);
    if (!r || !r.accounts) return {};

    const out: Record<string, number> = {};
    r.accounts.forEach((a: any) => {
      const val = Number(a.activeStake || a.delegationActiveStake || 0);
      out[a.address] = val > 1e12 ? val / 1e18 : val;
    });

    return out;
  } catch {
    return {};
  }
}

/*───────────────────────────────────────────────
  🥈 Secondary — SC query (only if bulk fails completely)
─────────────────────────────────────────────────*/
async function fetchStakeContract(addr: string, retries = 4) {
  const provider = new ProxyNetworkProvider(network.gatewayAddress);
  for (let i = 0; i < retries; i++) {
    try {
      const q = new Query({
        address: new Address(network.delegationContract),
        func: new ContractFunction('getUserActiveStake'),
        args: [new AddressValue(new Address(addr))]
      });
      const d = await provider.queryContract(q);
      const [x] = d.getReturnDataParts();
      return x ? Number(decodeBigNumber(x)) / 1e18 : 0;
    } catch {
      await wait(130 * (i + 1));
    }
  }
  return null;
}

/*───────────────────────────────────────────────
  FETCH ALL STAKES
─────────────────────────────────────────────────*/
async function fetchStake_All(addresses: string[]) {
  let bulk: Record<string, number> = {};
  try {
    bulk = await fetchEgldBulkPrimary();
    if (!bulk || Object.keys(bulk).length === 0) {
      throw new Error("Bulk fetch failed");
    }
  } catch (err) {
    console.warn("Bulk fetch failed, fallback to per-address SC queries", err);
    const r = await Promise.allSettled(addresses.map(a => fetchStakeContract(a)));
    r.forEach((x, i) => {
      bulk[addresses[i]] =
        x.status === "fulfilled" && x.value != null ? x.value : 0;
    });
  }

  // ensure all addresses exist in the map
  addresses.forEach(addr => {
    if (!(addr in bulk)) bulk[addr] = 0;
  });

  return bulk;
}

/*───────────────────────────────────────────────*/
function calcColsOnlyApr({ sumColsStaked, baseApr, serviceFee, agencyLockedEgld, egldPrice, colsPrice }: any) {
  if (!sumColsStaked || !baseApr || !agencyLockedEgld || !egldPrice || !colsPrice) return 0;
  const base = baseApr / (1 - serviceFee) / 100;
  return ((agencyLockedEgld * base * AGENCY_BUYBACK * serviceFee * DAO_DISTRIBUTION_RATIO * egldPrice)
    / (colsPrice * sumColsStaked)) * 100;
}

/*───────────────────────────────────────────────
  MAIN HOOK
─────────────────────────────────────────────────*/
export function useColsApr({ trigger }: { trigger: any }) {
  const [loading, setLoading] = useState(true);
  const [stakers, setStakers] = useState<ColsStakerRow[]>([]);
  const [egldPrice, setEgldPrice] = useState(0);
  const [colsPrice, setColsPrice] = useState(0);
  const [baseApr, setBaseApr] = useState(0);
  const [agencyLockedEgld, setAgencyLockedEgld] = useState(0);
  const [aprMax, setAprMax] = useState(15);
  const [targetAvgAprBonus, setTargetAvgAprBonus] = useState(0);

  const { contractDetails } = useGlobalContext();

  const fetchColsStakers = useCallback(async () => {
    const p = new ProxyNetworkProvider(network.gatewayAddress);
    const q = new Query({
      address: new Address(PEERME_COLS_CONTRACT),
      func: new ContractFunction('getEntityUsers'),
      args: [new AddressValue(new Address(PEERME_ENTITY_ADDRESS))]
    });
    const d = await p.queryContract(q);
    const x = d.getReturnDataParts();
    const arr: any[] = [];
    for (let i = 0; i < x.length; i += 2)
      arr.push({ address: new Address(x[i]).bech32(), colsStaked: Number(decodeBigNumber(x[i + 1])) / 1e18 });
    return arr;
  }, []);

  const recalc = useCallback(async () => {
    setLoading(true);
    try {
      const [users, pE, pC, pA, pL] = await Promise.all([
        fetchColsStakers(), fetchEgldPrice(),
        fetchColsPriceFromApi(), fetchBaseAprFromApi(),
        fetchAgencyLockedEgld()
      ]);
      setEgldPrice(pE); setColsPrice(pC); setBaseApr(pA); setAgencyLockedEgld(pL);

      const addresses = users.map(u => u.address);

      /* 🔥 Fetch eGLD stakes */
      const egldMap = await fetchStake_All(addresses);

      const table: ColsStakerRow[] = users.map(u => ({
        address: u.address,
        colsStaked: u.colsStaked,
        egldStaked: egldMap[u.address] ?? 0,
        ratio: null, normalized: null, aprBonus: null, dao: null, aprTotal: null, rank: null
      }));

      let serviceFee = 0.10;
      if (contractDetails?.data?.serviceFee) {
        const num = parseFloat(contractDetails.data.serviceFee.replace('%', '').trim());
        if (!isNaN(num)) serviceFee = num / 100;
      }

      const baseCorrected = pA / (1 - serviceFee) / 100;
      const targetAvg = ((pL * baseCorrected * AGENCY_BUYBACK * serviceFee * BONUS_BUYBACK_FACTOR * pE) / pC) / 365;
      setTargetAvgAprBonus(targetAvg);

      const aprMin = 0.5; let L = 0.5, R = 50, best = 15;
      const calc = (mx: number) => {
        const f = table.filter(r => r.colsStaked > 0 && r.egldStaked > 0);
        if (!f.length) return 0;
        let mn = 1e99, mxv = -1e99;
        f.forEach(r => {
          r.ratio = (r.colsStaked * pC) / (r.egldStaked * pE);
          mn = Math.min(mn, r.ratio!); mxv = Math.max(mxv, r.ratio!);
        });
        f.forEach(r => {
          r.normalized = (mxv !== mn) ? ((r.ratio! - mn) / (mxv - mn)) : 0;
          r.aprBonus = aprMin + (mx - aprMin) * Math.sqrt(r.normalized);
        });
        return f.reduce((s, r) => s + (((r.aprBonus! / 100) * r.egldStaked * pE) / 365 / pC), 0);
      };

      for (let i = 0; i < 30; i++) {
        const mid = (L + R) / 2;
        const sum = calc(mid);
        if (Math.abs(sum - targetAvg) < 0.01) { best = mid; break; }
        if (sum < targetAvg) L = mid; else R = mid;
        best = mid;
      }
      setAprMax(best);

      const ratios = table
        .filter(r => r.egldStaked > 0 && r.colsStaked > 0)
        .map(r => (r.colsStaked * pC) / (r.egldStaked * pE));
      const mn = Math.min(...ratios), mx = Math.max(...ratios);

      const sumCols = table.reduce((s, r) => s + (r.colsStaked || 0), 0);

      table.forEach(r => {
        r.normalized = (r.colsStaked && r.egldStaked && mx !== mn)
          ? ((r.colsStaked * pC) / (r.egldStaked * pE) - mn) / (mx - mn) : null;
        r.aprBonus = r.normalized != null ? aprMin + (best - aprMin) * Math.sqrt(r.normalized) : null;
        if (r.egldStaked && r.colsStaked && sumCols) {
          r.dao = (((pL * baseCorrected * AGENCY_BUYBACK * serviceFee * DAO_DISTRIBUTION_RATIO * r.colsStaked)
            / sumCols / r.egldStaked) * 100);
        }
        r.aprColsOnly = r.colsStaked ? calcColsOnlyApr({
          sumColsStaked: sumCols, baseApr: pA, serviceFee, agencyLockedEgld: pL,
          egldPrice: pE, colsPrice: pC
        }) : null;
        r.aprTotal = r.egldStaked ? pA + (r.aprBonus || 0) + (r.dao || 0)
          : r.colsStaked ? (r.aprColsOnly ?? pA)
            : pA;
      });

      const sorted = [...table].sort((a, b) => (b.aprTotal || 0) - (a.aprTotal || 0));
      sorted.forEach((r, i) => r.rank = i + 1);
      setStakers(sorted);
    }
    catch (e) { console.error(e); setStakers([]); }
    finally { setLoading(false); }
  }, [trigger]);

  useEffect(() => { recalc(); }, [trigger, recalc]);

  return {
    loading, stakers, egldPrice, colsPrice,
    baseApr, agencyLockedEgld, aprMax, targetAvgAprBonus, recalc
  };
}
