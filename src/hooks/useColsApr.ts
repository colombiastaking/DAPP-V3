import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Address,
  ContractFunction,
  AddressValue,
  decodeBigNumber
} from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { network } from 'config';
import { useGlobalContext } from 'context';
import { fetchWithBackup } from '../utils/resilientApi';
import { createContractQuery } from 'helpers/contractQuery';

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

const PRIMARY_PROVIDER_API =
  `https://staking.colombia-staking.com/mvx-api/providers/${network.delegationContract}`;
const BACKUP_PROVIDER_API =
  `https://api.multiversx.com/providers/${network.delegationContract}`;

const MAIN_GATEWAY = network.gatewayAddress;
const BACKUP_GATEWAY = 'https://gateway.multiversx.com';

type ApiMode = 'main' | 'backup';

/* ───────────────────────────────────────────────
   TYPES
──────────────────────────────────────────────────*/
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

const safe = (v?: number | null) => (isFinite(v || 0) ? v || 0 : 0);

/*───────────────────────────────────────────────
  API MODE DETECTION
─────────────────────────────────────────────────*/
async function detectApiMode(): Promise<ApiMode> {
  try {
    const r = await axios.get(PRIMARY_PROVIDER_API, { timeout: 4000 });
    if (r.data?.apr) return 'main';
  } catch {}
  console.warn('⚠️ MAIN API / GATEWAY down → BACKUP MODE');
  return 'backup';
}

function getScProvider(mode: ApiMode) {
  return new ProxyNetworkProvider(
    mode === 'main' ? MAIN_GATEWAY : BACKUP_GATEWAY
  );
}

/*───────────────────────────────────────────────
  PRICE & BASE DATA (MODE AWARE)
─────────────────────────────────────────────────*/
async function fetchBaseApr(mode: ApiMode) {
  const url = mode === 'main' ? PRIMARY_PROVIDER_API : BACKUP_PROVIDER_API;
  try {
    const { data } = await axios.get(url, { timeout: 6000 });
    return data?.apr ?? 0;
  } catch { return 0; }
}

async function fetchAgencyLockedEgld(mode: ApiMode) {
  const url = mode === 'main' ? PRIMARY_PROVIDER_API : BACKUP_PROVIDER_API;
  try {
    const { data } = await axios.get(url, { timeout: 6000 });
    return data?.locked ? Number(data.locked) / 1e18 : 0;
  } catch { return 0; }
}

async function fetchEgldPrice(mode: ApiMode) {
  const url =
    mode === 'main'
      ? `${network.apiAddress}/economics`
      : `https://api.multiversx.com/economics`;

  try {
    const { data } = await axios.get(url, { timeout: 6000 });
    return Number(data.price);
  } catch { return 0; }
}

async function fetchColsPrice(mode: ApiMode) {
  if (mode === 'main') {
    const data = await fetchWithBackup<any>(
      'https://api.multiversx.com/mex/tokens/prices/hourly/COLS-9d91b7',
      'https://staking.colombia-staking.com/mvx-api/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7'
    );
    if (Array.isArray(data) && data[data.length - 1]?.value)
      return Number(data[data.length - 1].value);
  }

  try {
    const r = await axios.get(
      'https://api.multiversx.com/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7',
      { timeout: 6000 }
    );
    return Number(r.data?.[0]?.price ?? 0);
  } catch { return 0; }
}

/*───────────────────────────────────────────────
  BULK EGLD FETCH WITH FALLBACK
─────────────────────────────────────────────────*/
async function fetchEgldBulkWithFallback(): Promise<Record<string, number>> {
  // Try backup API first (more reliable)
  const backupUrl = `https://api.multiversx.com/providers/${network.delegationContract}/accounts?size=10000`;
  
  try {
    const { data } = await axios.get(backupUrl, { timeout: 30000 });
    const accounts = Array.isArray(data) ? data : (data?.accounts || []);
    const out: Record<string, number> = {};
    for (const a of accounts) {
      const v = Number(a.activeStake || a.delegationActiveStake || a.stake || 0);
      out[a.address] = v > 1e12 ? v / 1e18 : v;
    }
    if (Object.keys(out).length > 0) {
      console.log(`✅ Bulk EGLD fetched: ${Object.keys(out).length} accounts`);
      return out;
    }
  } catch (e) {
    console.warn('⚠️ Backup bulk API failed');
  }
  
  // Try primary
  const primaryUrl = `https://staking.colombia-staking.com/mvx-api/providers/${network.delegationContract}/accounts?size=10000`;
  try {
    const { data } = await axios.get(primaryUrl, { timeout: 30000 });
    const accounts = Array.isArray(data) ? data : (data?.accounts || []);
    const out: Record<string, number> = {};
    for (const a of accounts) {
      const v = Number(a.activeStake || a.delegationActiveStake || a.stake || 0);
      out[a.address] = v > 1e12 ? v / 1e18 : v;
    }
    if (Object.keys(out).length > 0) {
      console.log(`✅ Primary bulk EGLD fetched: ${Object.keys(out).length} accounts`);
      return out;
    }
  } catch (e) {
    console.warn('⚠️ Primary bulk API failed');
  }
  
  console.error('❌ All bulk APIs failed, returning empty');
  return {};
}

/*───────────────────────────────────────────────
  MAIN HOOK
─────────────────────────────────────────────────*/
export function useColsApr({ trigger, userActiveStakeRaw, userAddress }: { trigger: any; userActiveStakeRaw?: string | null; userAddress?: string }) {
  const [loading, setLoading] = useState(true);
  const [stakers, setStakers] = useState<ColsStakerRow[]>([]);
  const [egldPrice, setEgldPrice] = useState(0);
  const [colsPrice, setColsPrice] = useState(0);
  const [baseApr, setBaseApr] = useState(0);
  const [agencyLockedEgld, setAgencyLockedEgld] = useState(0);
  const [aprMax, setAprMax] = useState(15);
  const [targetAvgAprBonus, setTargetAvgAprBonus] = useState(0);
  const [totalColsStaked, setTotalColsStaked] = useState(0);

  const { contractDetails } = useGlobalContext();

  const fetchColsStakers = useCallback(async (mode: ApiMode) => {
    const p = getScProvider(mode);
    const q = createContractQuery({
      address: new Address(PEERME_COLS_CONTRACT),
      func: new ContractFunction('getEntityUsers'),
      args: [new AddressValue(new Address(PEERME_ENTITY_ADDRESS))]
    });

    const d = await p.queryContract(q);
    const x = d.getReturnDataParts();
    const arr: any[] = [];

    for (let i = 0; i < x.length; i += 2) {
      arr.push({
        address: new Address(x[i]).toBech32(),
        colsStaked: Number(decodeBigNumber(x[i + 1])) / 1e18
      });
    }
    return arr;
  }, []);

  const recalc = useCallback(async () => {
    setLoading(true);
    try {
      const mode = await detectApiMode();

      const [users, pE, pC, pA, pL] = await Promise.all([
        fetchColsStakers(mode),
        fetchEgldPrice(mode),
        fetchColsPrice(mode),
        fetchBaseApr(mode),
        fetchAgencyLockedEgld(mode)
      ]);

      if (!pE || !pC || !pA || !pL) {
        console.error('❌ APR aborted — invalid data', { mode, pE, pC, pA, pL });
        setStakers([]);
        return;
      }

      setEgldPrice(pE);
      setColsPrice(pC);
      setBaseApr(pA);
      setAgencyLockedEgld(pL);

      const egldMap = await fetchEgldBulkWithFallback();

      const table: ColsStakerRow[] = users.map(u => ({
        address: u.address,
        colsStaked: u.colsStaked,
        // If this is the current user and we have context data, use it (more reliable)
        egldStaked: (userActiveStakeRaw && userAddress && u.address.toLowerCase() === userAddress.toLowerCase()) 
          ? Number(userActiveStakeRaw) / 1e18 
          : (egldMap[u.address] || 0),
        ratio: null,
        normalized: null,
        aprBonus: null,
        dao: null,
        aprTotal: null,
        rank: null
      }));

      let serviceFee = 0.10;
      if (contractDetails?.data?.serviceFee) {
        const n = parseFloat(contractDetails.data.serviceFee.replace('%', ''));
        if (!isNaN(n)) serviceFee = n / 100;
      }

      const baseCorrected = pA / (1 - serviceFee) / 100;
      const targetAvg =
        ((pL * baseCorrected * AGENCY_BUYBACK * serviceFee * BONUS_BUYBACK_FACTOR * pE) / pC) / 365;

      setTargetAvgAprBonus(targetAvg);

      const aprMin = 0.5;
      let L = 0.5, R = 50, best = 15;

      const calc = (mx: number) => {
        const f = table.filter(r => r.colsStaked && r.egldStaked);
        if (!f.length) return 0;

        let mn = Infinity, mxv = -Infinity;
        f.forEach(r => {
          r.ratio = (r.colsStaked * pC) / (r.egldStaked * pE);
          mn = Math.min(mn, r.ratio);
          mxv = Math.max(mxv, r.ratio);
        });

        f.forEach(r => {
          r.normalized = mxv !== mn ? (r.ratio! - mn) / (mxv - mn) : 0;
          r.aprBonus = aprMin + (mx - aprMin) * Math.sqrt(r.normalized);
        });

        return f.reduce(
          (s, r) => s + ((r.aprBonus! / 100) * r.egldStaked * pE) / 365 / pC,
          0
        );
      };

      for (let i = 0; i < 30; i++) {
        const mid = (L + R) / 2;
        const sum = calc(mid);
        if (Math.abs(sum - targetAvg) < 0.01) { best = mid; break; }
        sum < targetAvg ? (L = mid) : (R = mid);
        best = mid;
      }

      setAprMax(best);

      const sumCols = table.reduce((s, r) => s + r.colsStaked, 0);
      setTotalColsStaked(sumCols);

      // Calculate total DAO pool per year (in EGLD), then convert to daily COLS
      // This matches the distribution script formula:
      // dailyBuyback = (locked * baseCorrected * BUYBACK * serviceFee * egldPrice) / colsPrice / 365
      // daoPool = dailyBuyback * DAO_RATIO (then distributed proportionally to COLS)
      const totalDailyBuybackCols = (pL * baseCorrected * AGENCY_BUYBACK * serviceFee * pE) / pC / 365;

      table.forEach(r => {
        // Calculate DAO for users with both COLS and eGLD
        // Guard: only calculate if user has valid eGLD stake > 0
        if (r.egldStaked && r.egldStaked > 0.001 && r.colsStaked && sumCols > 0) {
          // Daily DAO COLS = (daoPoolDaily * user's COLS / total COLS)
          const userDailyDaoCols = (totalDailyBuybackCols * DAO_DISTRIBUTION_RATIO * r.colsStaked) / sumCols;
          // Convert to EGLD: dailyDao * colsPrice / egldPrice
          const userDailyDaoEgld = userDailyDaoCols * pC / pE;
          // Annual DAO EGLD
          const userYearlyDaoEgld = userDailyDaoEgld * 365;
          // DAO APR = (yearly DAO EGLD / user's eGLD stake) * 100
          r.dao = (userYearlyDaoEgld / r.egldStaked) * 100;
        } else {
          r.dao = null;
        }
        
        // Calculate APR total
        if (r.egldStaked && r.colsStaked) {
          // Has both eGLD and COLS: base + bonus + DAO
          r.aprTotal = safe(pA + safe(r.aprBonus) + safe(r.dao));
        } else if (r.colsStaked && !r.egldStaked) {
          // COLS only: base APR only (no bonus, no DAO APR since no eGLD staked)
          r.aprTotal = safe(pA);
        } else {
          // No COLS: just base APR
          r.aprTotal = safe(pA);
        }
      });

      const sorted = [...table].sort((a, b) => safe(b.aprTotal) - safe(a.aprTotal));
      sorted.forEach((r, i) => r.rank = i + 1);
      setStakers(sorted);
    } catch (e) {
      console.error(e);
      setStakers([]);
    } finally {
      setLoading(false);
    }
  }, [trigger, contractDetails, userActiveStakeRaw, userAddress]);

  useEffect(() => { recalc(); }, [recalc, trigger]);

  return {
    loading,
    stakers,
    egldPrice,
    colsPrice,
    baseApr,
    agencyLockedEgld,
    aprMax,
    targetAvgAprBonus,
    totalColsStaked,
    recalc
  };
}
