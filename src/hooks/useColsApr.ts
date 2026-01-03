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

const PRIMARY_PROVIDER_API =
  `https://staking.colombia-staking.com/mvx-api/providers/${network.delegationContract}`;
const PRIMARY_PROVIDER_ACCOUNTS =
  `${PRIMARY_PROVIDER_API}/accounts?size=10000`;

const BACKUP_PROVIDER_API =
  `https://api.multiversx.com/providers/${network.delegationContract}`;
const BACKUP_ACCOUNTS_API =
  `https://api.multiversx.com/providers/${network.delegationContract}/accounts?size=10000`;

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
  PRICE & BASE DATA FETCHERS
─────────────────────────────────────────────────*/
async function fetchColsPriceFromApi() {
  const primary =
    'https://api.multiversx.com/mex/tokens/prices/hourly/COLS-9d91b7';

  const backup1 =
    'https://staking.colombia-staking.com/mvx-api/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7';

  const backup2 =
    'https://api.multiversx.com/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7';

  // 1️⃣ try primary + backup1
  let data = await fetchWithBackup<any>(primary, backup1);

  // 2️⃣ if still empty → final fallback
  if (!data) {
    try {
      const r = await axios.get(backup2, { timeout: 6000 });
      data = r.data;
    } catch {
      return 0;
    }
  }

  // ── normalize formats ─────────────────────
  if (Array.isArray(data) && data[data.length - 1]?.value)
    return +data[data.length - 1].value.toFixed(3);

  if (Array.isArray(data) && data[0]?.price)
    return +data[0].price.toFixed(3);

  if (Array.isArray(data) && data[0]?.balance && data[0]?.price)
    return +Number(data[0].price).toFixed(3);

  return 0;
}

async function fetchBaseAprFromApi() {
  const d = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  return d?.apr ?? 0;
}

async function fetchAgencyLockedEgld() {
  const d = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  return d?.locked ? +(Number(d.locked) / 1e18).toFixed(4) : 0;
}

async function fetchEgldPrice() {
  try {
    const { data } = await axios.get(`${network.apiAddress}/economics`);
    return Number(data.price);
  } catch { return 0; }
}

/*───────────────────────────────────────────────
  BULK EGLD ACCOUNT FETCH
─────────────────────────────────────────────────*/
async function fetchEgldBulkPrimary(): Promise<Record<string, number>> {
  try {
    const r = await fetchWithBackup<any>(PRIMARY_PROVIDER_ACCOUNTS, BACKUP_ACCOUNTS_API);
    if (!r?.accounts?.length) throw new Error("Bulk empty → fallback");

    const out: Record<string, number> = {};
    r.accounts.forEach((a: any) => {
      const v = Number(a.activeStake || a.delegationActiveStake || 0);
      out[a.address] = v > 1e12 ? v / 1e18 : v;
    });
    return out;
  } catch {
    console.warn("⚠️ bulk API failed → per-address querying later");
    return {};
  }
}

/*───────────────────────────────────────────────
  🔥 SMART CONTRACT ONLY (Main + Backup)
  - 4 tries main SC `getUserActiveStake`
  - If still failing → SC backup call `getUserStake`
  ❗ NO REST ENDPOINT ANYMORE
─────────────────────────────────────────────────*/
async function fetchStakeContract(addr: string) {
  const main = new ProxyNetworkProvider(network.gatewayAddress);
  const backup = new ProxyNetworkProvider("https://gateway.multiversx.com"); // backup SC RPC

  const q1 = new Query({
    address: new Address(network.delegationContract),
    func: new ContractFunction("getUserActiveStake"),
    args: [new AddressValue(new Address(addr))]
  });

  // MAIN (4 retry attempts)
  for (let i = 0; i < 4; i++) {
    try {
      const r = await main.queryContract(q1);
      const [raw] = r.getReturnDataParts();
      if (raw) return Number(decodeBigNumber(raw)) / 1e18;
    } catch {
      await wait(200 * (i + 1));
    }
  }

  console.warn(`⚠️ MAIN SC failed → activating SC backup for ${addr}`);

  // BACKUP SC SAME CALL
  try {
    const r2 = await backup.queryContract(q1);
    const [raw2] = r2.getReturnDataParts();
    if (raw2) return Number(decodeBigNumber(raw2)) / 1e18;
  } catch {}

  // LAST OPTION — alternative SC (slower but reliable)
  try {
    const q2 = new Query({
      address: new Address(network.delegationContract),
      func: new ContractFunction("getUserStake"),
      args: [new AddressValue(new Address(addr))]
    });
    const r3 = await backup.queryContract(q2);
    const [raw3] = r3.getReturnDataParts();
    if (raw3) return Number(decodeBigNumber(raw3)) / 1e18;
  } catch {
    console.warn("❌ SC backup also failed", addr);
  }

  return 0;
}

/*───────────────────────────────────────────────
  GLOBAL STAKE FETCHER
─────────────────────────────────────────────────*/
async function fetchStake_All(addresses: string[]) {
  let bulk = await fetchEgldBulkPrimary();

  if (!Object.keys(bulk).length) {
    console.warn("⛓ SC fallback for ALL delegators...");
    const r = await Promise.allSettled(addresses.map(a => fetchStakeContract(a)));
    r.forEach((x, i) => bulk[addresses[i]] = x.status === "fulfilled" ? x.value as number : 0);
  }

  addresses.forEach(a => { if (!(a in bulk)) bulk[a] = 0; });
  return bulk;
}

/*───────────────────────────────────────────────
  APR CALCULATIONS
─────────────────────────────────────────────────*/
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
        fetchColsStakers(), fetchEgldPrice(), fetchColsPriceFromApi(),
        fetchBaseAprFromApi(), fetchAgencyLockedEgld()
      ]);
      setEgldPrice(pE); setColsPrice(pC); setBaseApr(pA); setAgencyLockedEgld(pL);

      const addresses = users.map(u => u.address);
      const egldMap = await fetchStake_All(addresses);

      const table: ColsStakerRow[] = users.map(u => ({
        address: u.address, colsStaked: u.colsStaked,
        egldStaked: egldMap[u.address] ?? 0,
        ratio: null, normalized: null, aprBonus: null, dao: null, aprTotal: null, rank: null
      }));

      let serviceFee = 0.10;
      if (contractDetails?.data?.serviceFee) {
        const n = parseFloat(contractDetails.data.serviceFee.replace('%', '').trim());
        if (!isNaN(n)) serviceFee = n / 100;
      }

      const baseCorrected = pA / (1 - serviceFee) / 100;
      const targetAvg = ((pL * baseCorrected * AGENCY_BUYBACK * serviceFee * BONUS_BUYBACK_FACTOR * pE) / pC) / 365;
      setTargetAvgAprBonus(targetAvg);

      const aprMin = 0.5; let L = 0.5, R = 50, best = 15;
      const calc = (mx: number) => {
        const f = table.filter(r => r.colsStaked > 0 && r.egldStaked > 0);
        if (!f.length) return 0;
        let mn = 1e9, mxv = -1e9;
        f.forEach(r => { r.ratio = (r.colsStaked * pC) / (r.egldStaked * pE); mn=Math.min(mn,r.ratio!); mxv=Math.max(mxv,r.ratio!)});
        f.forEach(r => { r.normalized = (mxv!==mn)?((r.ratio!-mn)/(mxv-mn)):0; r.aprBonus=aprMin+(mx-aprMin)*Math.sqrt(r.normalized!);});
        return f.reduce((s,r)=>s+(((r.aprBonus!/100)*r.egldStaked*pE)/365/pC),0);
      };

      for (let i = 0; i < 30; i++) {
        const mid = (L + R) / 2;
        const sum = calc(mid);
        if (Math.abs(sum - targetAvg) < 0.01) { best = mid; break; }
        if (sum < targetAvg) L = mid; else R = mid;
        best = mid;
      }
      setAprMax(best);

      const ratios = table.filter(r=>r.egldStaked&&r.colsStaked)
        .map(r=> (r.colsStaked*pC)/(r.egldStaked*pE));
      const mn = Math.min(...ratios), mx = Math.max(...ratios);

      const sumCols = table.reduce((s,r)=>s+(r.colsStaked||0),0);

      table.forEach(r=>{
        r.normalized = (r.colsStaked&&r.egldStaked&&mx!==mn)?(((r.colsStaked*pC)/(r.egldStaked*pE)-mn)/(mx-mn)):null;
        r.aprBonus = r.normalized!=null?aprMin+(best-aprMin)*Math.sqrt(r.normalized):null;
        if(r.egldStaked&&r.colsStaked&&sumCols){
          r.dao=(((pL*baseCorrected*AGENCY_BUYBACK*serviceFee*DAO_DISTRIBUTION_RATIO*r.colsStaked)/sumCols/r.egldStaked)*100);
        }
        r.aprColsOnly = r.colsStaked?calcColsOnlyApr({sumColsStaked:sumCols,baseApr:pA,serviceFee,agencyLockedEgld:pL,egldPrice:pE,colsPrice:pC}):null;
        r.aprTotal = r.egldStaked?pA+(r.aprBonus||0)+(r.dao||0):r.colsStaked?(r.aprColsOnly??pA):pA;
      });

      const sorted=[...table].sort((a,b)=>(b.aprTotal||0)-(a.aprTotal||0));
      sorted.forEach((r,i)=>r.rank=i+1);
      setStakers(sorted);
    }
    catch(e){ console.error(e); setStakers([]); }
    finally{ setLoading(false); }
  },[trigger]);

  useEffect(()=>{ recalc(); },[trigger,recalc]);

  return {loading,stakers,egldPrice,colsPrice,baseApr,agencyLockedEgld,aprMax,targetAvgAprBonus,recalc};
}
