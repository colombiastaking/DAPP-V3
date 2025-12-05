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

/* ================================
   CONFIG / CONSTANTS
================================ */
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

  /** NEW FIELDS FOR EGLD-ONLY USERS **/
  potentialApr?: number | null;
  infoMessage?: string | null;
}

/* ================================ */
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

/* ================================
   FETCH economics
================================ */
async function fetchColsPriceFromApi() {
  const primary = 'https://api.multiversx.com/mex/tokens/prices/hourly/COLS-9d91b7';
  const backup =
    'https://staking.colombia-staking.com/mvx-api/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7';

  const data = await fetchWithBackup<any>(primary, backup);
  if (!data) return 0;

  if (Array.isArray(data) && data.length > 0 && typeof data[data.length - 1].value === 'number')
    return Math.round(data[data.length - 1].value * 1000) / 1000;

  if (Array.isArray(data) && typeof data[0]?.price === 'number')
    return Math.round(data[0].price * 1000) / 1000;

  return 0;
}

async function fetchBaseAprFromApi() {
  const data = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  return data?.apr ? data.apr : 0;
}

async function fetchAgencyLockedEgld() {
  const data = await fetchWithBackup<any>(PRIMARY_PROVIDER_API, BACKUP_PROVIDER_API);
  return data?.locked ? Math.round((Number(data.locked) / 1e18) * 10000) / 10000 : 0;
}

async function fetchEgldPrice() {
  try {
    const { data } = await axios.get(`${network.apiAddress}/economics`);
    return Number(data.price);
  } catch {
    return 0;
  }
}

/* ================================
   STAKE FETCH (contract priority)
================================ */

async function fetchStakeContract(addr: string, retries = 5) {
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
      return stake ? Number(decodeBigNumber(stake)) / 1e18 : 0;
    } catch {
      await wait(200 * (i + 1));
    }
  }
  return null;
}

async function fetchStakeApiBackup(addr: string): Promise<number|null> {
  try {
    const res = await axios.get(`${network.apiAddress}/accounts/${addr}`);
    const d = res.data;

    const candidates = [
      d?.delegationActiveStake, d?.activeStake,
      d?.account?.delegationActiveStake,
      d?.account?.activeStake
    ];

    for (const c of candidates) {
      if (c == null) continue;
      const v = Number(c);
      return v > 1e12 ? v / 1e18 : v;
    }

    return null;
  } catch {
    return null;
  }
}

async function fetchEgldStakedContractPriority(addresses: string[]): Promise<Record<string, number>> {
  let result: Record<string, number> = {};

  const primary = await Promise.allSettled(addresses.map(a => fetchStakeContract(a)));

  addresses.forEach((addr, idx) => {
    const r = primary[idx];
    result[addr] = (r.status === 'fulfilled' && r.value !== null) ? r.value : -1;
  });

  const fallbackList = Object.keys(result).filter(a => result[a] === -1);

  if (fallbackList.length) {
    const backup = await Promise.allSettled(fallbackList.map(a => fetchStakeApiBackup(a)));
    backup.forEach((r, i) => {
      const addr = fallbackList[i];
      result[addr] = (r.status === 'fulfilled' && r.value !== null) ? r.value : 0;
    });
  }

  return result;
}

/* ================================
   APR ENGINE
================================ */

function calculateColsOnlyApr({
  sumColsStaked, baseApr, serviceFee,
  agencyLockedEgld, egldPrice, colsPrice
}: any) {
  if (!sumColsStaked || !baseApr || !agencyLockedEgld || !egldPrice || !colsPrice)
    return 0;

  const base = baseApr/(1-serviceFee)/100;
  return ((agencyLockedEgld*base*AGENCY_BUYBACK*serviceFee*DAO_DISTRIBUTION_RATIO*egldPrice)
    /(colsPrice*sumColsStaked))*100;
}

/* ================================
   MAIN HOOK
================================ */

export function useColsApr({ trigger }: { trigger: any }) {
  const [loading,setLoading]=useState(true);
  const [stakers,setStakers]=useState<ColsStakerRow[]>([]);
  const [egldPrice,setEgldPrice]=useState(0);
  const [colsPrice,setColsPrice]=useState(0);
  const [baseApr,setBaseApr]=useState(0);
  const [agencyLockedEgld,setAgencyLockedEgld]=useState(0);
  const [aprMax,setAprMax]=useState(15);
  const [targetAvgAprBonus,setTargetAvgAprBonus]=useState(0);

  const { contractDetails } = useGlobalContext();

  const fetchColsStakers = useCallback(async () => {
    const provider = new ProxyNetworkProvider(network.gatewayAddress);
    const query = new Query({
      address: new Address(PEERME_COLS_CONTRACT),
      func: new ContractFunction('getEntityUsers'),
      args: [new AddressValue(new Address(PEERME_ENTITY_ADDRESS))]
    });
    const data = await provider.queryContract(query);
    const parts = data.getReturnDataParts();

    const arr: any[] = [];
    for (let i=0;i<parts.length;i+=2) {
      arr.push({
        address:new Address(parts[i]).bech32(),
        colsStaked:Number(decodeBigNumber(parts[i+1]))/1e18
      });
    }
    return arr;
  },[]);

  const recalc = useCallback(async()=>{
    setLoading(true);

    try{
      const [users,pE,pC,pA,pL] = await Promise.all([
        fetchColsStakers(), fetchEgldPrice(),
        fetchColsPriceFromApi(), fetchBaseAprFromApi(),
        fetchAgencyLockedEgld()
      ]);

      setEgldPrice(pE); setColsPrice(pC);
      setBaseApr(pA); setAgencyLockedEgld(pL);

      /** 🔥 FETCH EGLD for all COLS users — but will later add EGLD-only users if desired */
      const addresses = users.map(u=>u.address);
      const egldStakedMap = await fetchEgldStakedContractPriority(addresses);

      /** Build table rows */
      const table: ColsStakerRow[] = users.map(u=>({
        address:u.address,
        colsStaked:u.colsStaked,
        egldStaked:egldStakedMap[u.address] ?? 0,
        ratio:null,normalized:null,aprBonus:null,
        dao:null,aprTotal:null,rank:null,aprColsOnly:null,
        potentialApr:null,infoMessage:null
      }));

      /** SERVICE FEE IMPORT **/
      let serviceFee=0.10;
      if(contractDetails?.data?.serviceFee){
        const num=parseFloat(contractDetails.data.serviceFee.replace('%','').trim());
        if(!isNaN(num)) serviceFee=num/100;
      }

      /** MIN/MAX APR TARGETING */
      const aprMin=0.5; let L=0.5,R=50,best=15;
      const calc=(mx:number)=>{
        const f=table.filter(r=>r.colsStaked>0&&r.egldStaked>0);
        if(!f.length)return 0;

        let mn=Number.POSITIVE_INFINITY,mxv=Number.NEGATIVE_INFINITY;
        f.forEach(r=>{
          // safe guards for division
          if (r.egldStaked > 0) {
            r.ratio = (r.colsStaked * pC) / (r.egldStaked * pE);
            mn = Math.min(mn, r.ratio!);
            mxv = Math.max(mxv, r.ratio!);
          } else {
            r.ratio = 0;
            mn = Math.min(mn, 0);
            mxv = Math.max(mxv, 0);
          }
        });

        f.forEach(r=>{
          r.normalized=(mxv!==mn)?((r.ratio!-mn)/(mxv-mn)):0;
          r.aprBonus=aprMin+(mx-aprMin)*Math.sqrt(r.normalized);
        });
        return f.reduce((s,r)=>s+(((r.aprBonus!/100)*r.egldStaked*pE)/365/pC),0);
      };

      const baseCorrected=pA/(1-serviceFee)/100;
      const targetAvg=((pL*baseCorrected*AGENCY_BUYBACK*serviceFee*BONUS_BUYBACK_FACTOR*pE)/pC)/365;
      setTargetAvgAprBonus(targetAvg);

      for(let i=0;i<30;i++){
        const mid=(L+R)/2;
        const sum=calc(mid);
        if(Math.abs(sum-targetAvg)<0.01){best=mid;break;}
        if(sum<targetAvg)L=mid; else R=mid;
        best=mid;
      }
      setAprMax(best);

      const sumCols=table.reduce((s,r)=>s+(r.colsStaked||0),0);

      /** compute ratios safely for final pass */
      const ratios = table
        .filter(r => r.egldStaked > 0 && r.colsStaked > 0)
        .map(r => (r.colsStaked * pC) / (r.egldStaked * pE));

      const mn = (ratios.length > 0) ? Math.min(...ratios) : 0;
      const mx = (ratios.length > 0) ? Math.max(...ratios) : 0;

      table.forEach(r=>{
        // If both present, compute bonuses/dao/aprTotal
        if(r.colsStaked && r.egldStaked && sumCols){
          r.normalized=(mx!==mn)?((r.colsStaked*pC)/(r.egldStaked*pE)-mn)/(mx-mn):0;
          r.aprBonus=r.normalized!==null?aprMin+(best-aprMin)*Math.sqrt(r.normalized):0;

          r.dao = ((pL*baseCorrected*AGENCY_BUYBACK*serviceFee*DAO_DISTRIBUTION_RATIO*r.colsStaked)
            /sumCols/r.egldStaked)*100;

          r.aprColsOnly = calculateColsOnlyApr({
            sumColsStaked:sumCols,
            baseApr:pA, serviceFee,
            agencyLockedEgld:pL, egldPrice:pE, colsPrice:pC
          });

          r.aprTotal = pA + (r.aprBonus||0) + (r.dao||0);
        }

        /** NEW — EGLD ONLY USERS — base APR only */
        if(r.egldStaked > 0 && r.colsStaked === 0){
          r.aprTotal = pA;
          r.aprBonus = 0;
          r.dao = 0;
          r.rank = null;

          /** simulate if user stakes = eGLD amount */
          const simCols = r.egldStaked || 0;
          const newTotal = sumCols + simCols;

          const simColsApr = calculateColsOnlyApr({
            sumColsStaked: newTotal,
            baseApr: pA, serviceFee,
            agencyLockedEgld: pL, egldPrice: pE, colsPrice: pC
          });

          const simulatedTotalAPR = pA + simColsApr;

          r.potentialApr = simulatedTotalAPR;

          // safe fallback for formatting (TS-safe)
          const potApr = r.potentialApr ?? pA;

          r.infoMessage =
            `With ${simCols.toFixed(2)} COLS staked you could earn ~${potApr.toFixed(2)}% APR instead of base ${pA}%`;
        }
      });

      /** SORTING — COLS users first, EGLD-only below */
      const sorted=[...table].sort((a,b)=>{
        if(a.colsStaked>0 && b.colsStaked===0) return -1;
        if(a.colsStaked===0 && b.colsStaked>0) return  1;
        return (b.aprTotal||0)-(a.aprTotal||0);
      });

      /** Only rank users with COLS */
      sorted.filter(r=>r.colsStaked>0).forEach((r,i)=>r.rank=i+1);

      setStakers(sorted);
    }catch(e){
      console.error('APR calc failed',e); setStakers([]);
    }finally{setLoading(false);}
  },[trigger, contractDetails]);

  useEffect(()=>{recalc();},[trigger,recalc]);

  return {
    loading,stakers,egldPrice,colsPrice,
    baseApr,agencyLockedEgld,aprMax,targetAvgAprBonus,recalc
  };
}
