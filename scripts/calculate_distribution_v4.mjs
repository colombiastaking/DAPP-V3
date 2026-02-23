import * as fs from "fs";
import { Address, decodeBigNumber } from "@multiversx/sdk-core";

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURATION (from dapp config)
// ════════════════════════════════════════════════════════════════════════════

// These are BUSINESS LOGIC constants (not hardcoded data)
const AGENCY_BUYBACK = 0.30;           // 30% of service fees → buyback
const DAO_DISTRIBUTION_RATIO = 0.333;  // 1/3 of buyback → DAO pool
const BONUS_BUYBACK_FACTOR = 0.66;     // 2/3 of buyback → Bonus pool
const APR_MIN = 0.5;                   // Minimum bonus APR (%)

// Network config (from dapp src/config)
const DELEGATION_CONTRACT = "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf";
const PEERME_COLS_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";
const PEERME_ENTITY_ADDRESS = "erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0";

// API endpoints (Local API as PRIMARY, Public as BACKUP - matches dapp exactly)
const PRIMARY_API = "http://192.168.0.120";
const BACKUP_API = "https://api.multiversx.com";
const PRIMARY_GATEWAY = "http://192.168.0.120/gateway";
const BACKUP_GATEWAY = "https://gateway.multiversx.com";

// ════════════════════════════════════════════════════════════════════════════
// RESILIENT FETCH (like dapp's fetchWithBackup)
// ════════════════════════════════════════════════════════════════════════════

async function fetchWithBackup(primaryUrl, backupUrl, retries = 2, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(primaryUrl, { timeout: 10000 });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      
      // Check for rate limit or API error in body
      if (data && typeof data === 'object' && data.error) {
        if (String(data.error).toLowerCase().includes('rate limit')) {
          if (i < retries - 1) {
            await new Promise(res => setTimeout(res, delayMs));
            continue;
          }
          break;
        }
      }
      return { data, mode: 'main' };
    } catch {}
  }
  
  // Backup API
  try {
    const r = await fetch(backupUrl, { timeout: 10000 });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return { data, mode: 'backup' };
  } catch (err) {
    console.error('Both APIs failed');
    return { data: null, mode: 'error' };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PRICE FETCHING (with backups, like dapp)
// ════════════════════════════════════════════════════════════════════════════

async function fetchEgldPrice() {
  // Try main economics endpoint
  try {
    const r = await fetch(`${PRIMARY_API}/economics`, { timeout: 6000 });
    const data = await r.json();
    if (data.price) return { price: Number(data.price), source: 'primary' };
  } catch {}
  
  // Backup: MultiversX public API
  try {
    const r = await fetch(`${BACKUP_API}/economics`, { timeout: 6000 });
    const data = await r.json();
    if (data.price) return { price: Number(data.price), source: 'backup' };
  } catch {}
  
  // Fallback: CoinGecko
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=elrond-erd-2&vs_currencies=usd", { timeout: 6000 });
    const data = await r.json();
    if (data["elrond-erd-2"]?.usd) return { price: data["elrond-erd-2"].usd, source: 'coingecko' };
  } catch {}
  
  return { price: 0, source: 'error' };
}

async function fetchColsPrice() {
  // Try MEX hourly price first (like dapp)
  try {
    const r = await fetch(`${BACKUP_API}/mex/tokens/prices/hourly/COLS-9d91b7`, { timeout: 6000 });
    const data = await r.json();
    if (Array.isArray(data) && data[data.length - 1]?.value) {
      return { price: Number(data[data.length - 1].value), source: 'mex-hourly' };
    }
  } catch {}
  
  // Backup: account token price
  try {
    const r = await fetch(`${BACKUP_API}/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7`, { timeout: 6000 });
    const data = await r.json();
    if (data?.[0]?.price) return { price: Number(data[0].price), source: 'account' };
  } catch {}
  
  return { price: 0, source: 'error' };
}

// ════════════════════════════════════════════════════════════════════════════
// PROVIDER DATA (APR, locked EGLD, serviceFee - ALL LIVE)
// ════════════════════════════════════════════════════════════════════════════

async function fetchProviderData() {
  const primaryUrl = `${PRIMARY_API}/providers/${DELEGATION_CONTRACT}`;
  const backupUrl = `${BACKUP_API}/providers/${DELEGATION_CONTRACT}`;
  
  const { data, mode } = await fetchWithBackup(primaryUrl, backupUrl);
  
  if (!data) {
    return { apr: 0, locked: 0, serviceFee: 0.10, numUsers: 0, mode: 'error' };
  }
  
  return {
    apr: data.apr || 0,
    locked: data.locked ? Number(data.locked) / 1e18 : 0,
    serviceFee: data.serviceFee || 0.10,  // LIVE from API (like dapp)
    numUsers: data.numUsers || 0,
    mode
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EGLD DELEGATORS (live bulk fetch with backup)
// ════════════════════════════════════════════════════════════════════════════

async function fetchEgldDelegators() {
  const primaryUrl = `${PRIMARY_API}/providers/${DELEGATION_CONTRACT}/accounts?size=10000`;
  const backupUrl = `${BACKUP_API}/providers/${DELEGATION_CONTRACT}/accounts?size=10000`;
  
  const { data, mode } = await fetchWithBackup(primaryUrl, backupUrl);
  
  const map = {};
  if (!data) {
    console.error('Failed to fetch EGLD delegators');
    return { map, mode: 'error' };
  }
  
  // Response can be array or {accounts: [...]}
  const accounts = Array.isArray(data) ? data : (data.accounts || []);
  
  for (const a of accounts) {
    const v = Number(a.activeStake || a.delegationActiveStake || a.stake || 0);
    map[a.address] = v > 1e12 ? v / 1e18 : v;
  }
  
  return { map, mode };
}

// ════════════════════════════════════════════════════════════════════════════
// COLS STAKERS (LIVE from smart contract, like dapp)
// ════════════════════════════════════════════════════════════════════════════

async function fetchColsStakers() {
  // Convert entity address to hex for query (gateway expects hex, not base64!)
  const entityAddress = new Address(PEERME_ENTITY_ADDRESS);
  const entityHex = entityAddress.toHex(); // e.g., "00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787"
  
  // Try primary gateway first, then backup
  const gateways = [PRIMARY_GATEWAY, BACKUP_GATEWAY];
  
  for (const gw of gateways) {
    try {
      const url = `${gw}/vm-values/query`;
      const payload = {
        scAddress: PEERME_COLS_CONTRACT,
        funcName: "getEntityUsers",
        args: [entityHex]
      };
      
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeout: 15000
      });
      
      const json = await r.json();
      const returnData = json?.data?.data?.returnData;
      
      if (!returnData || !Array.isArray(returnData)) continue;
      
      // Parse ALL pairs using SDK (exact match to dapp)
      const stakers = [];
      for (let i = 0; i < returnData.length; i += 2) {
        try {
          const addrBuf = Buffer.from(returnData[i], "base64");
          const amountBuf = Buffer.from(returnData[i + 1], "base64");
          
          // Convert to address using SDK (exact match to dapp)
          const addr = new Address(addrBuf).toBech32();
          const amount = Number(decodeBigNumber(amountBuf)) / 1e18;
          stakers.push({ address: addr, colsStaked: amount });
        } catch {}
      }
      
      console.log(`Fetched ${stakers.length} COLS stakers from SC (${gw === PRIMARY_GATEWAY ? 'primary' : 'backup'} gateway)`);
      return { stakers, mode: gw === PRIMARY_GATEWAY ? 'main' : 'backup' };
    } catch (e) {
      console.log(`Gateway ${gw} failed: ${e.message}`);
    }
  }
  
  console.error("All gateways failed for COLS stakers");
  return { stakers: [], mode: 'error' };
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN CALCULATION
// ════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═".repeat(70));
  console.log("📊 COLS DAILY DISTRIBUTION CALCULATOR (v4 - Full Dapp Logic)");
  console.log("═".repeat(70));
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log();

  // Fetch ALL data LIVE
  console.log("Fetching live data...");
  
  const [
    { stakers: colsStakers, mode: colsMode },
    { map: egldMap, mode: egldMode },
    { price: egldPrice, source: egldSource },
    { price: colsPrice, source: colsSource },
    providerData
  ] = await Promise.all([
    fetchColsStakers(),
    fetchEgldDelegators(),
    fetchEgldPrice(),
    fetchColsPrice(),
    fetchProviderData()
  ]);

  const { apr, locked, serviceFee, numUsers } = providerData;
  
  console.log();
  console.log("─".repeat(70));
  console.log("DATA SOURCES (ALL LIVE):");
  console.log("─".repeat(70));
  console.log(`COLS Stakers API:    ${colsMode} (${colsStakers.length} stakers)`);
  console.log(`EGLD Delegators API: ${egldMode} (${Object.keys(egldMap).length} delegators)`);
  console.log(`EGLD Price API:      ${egldSource} ($${egldPrice.toFixed(4)})`);
  console.log(`COLS Price API:      ${colsSource} ($${colsPrice.toFixed(6)})`);
  console.log(`Provider API:        ${providerData.mode}`);
  console.log();
  console.log("─".repeat(70));
  console.log("PROVIDER DATA (LIVE FROM API):");
  console.log("─".repeat(70));
  console.log(`Base APR:            ${apr.toFixed(2)}%`);
  console.log(`Agency Locked EGLD:  ${locked.toLocaleString()}`);
  console.log(`Service Fee:         ${(serviceFee * 100).toFixed(1)}% (from API)`);
  console.log(`Total Delegators:    ${numUsers}`);
  console.log();
  console.log("─".repeat(70));
  console.log("BUSINESS LOGIC CONSTANTS:");
  console.log("─".repeat(70));
  console.log(`Agency Buyback:      ${(AGENCY_BUYBACK * 100).toFixed(0)}% of service fees`);
  console.log(`DAO Distribution:    ${(DAO_DISTRIBUTION_RATIO * 100).toFixed(1)}% of buyback`);
  console.log(`Bonus Distribution:  ${(BONUS_BUYBACK_FACTOR * 100).toFixed(0)}% of buyback`);
  console.log(`Minimum Bonus APR:   ${APR_MIN}%`);
  console.log();

  if (!egldPrice || !colsPrice || !apr || !locked) {
    console.error("ERROR: Missing required data!");
    return;
  }

  // Build table with EGLD stakes
  const table = colsStakers.map(s => ({
    address: s.address,
    colsStaked: s.colsStaked,
    egldStaked: egldMap[s.address] || 0
  }));

  // Filter to eligible (both COLS + EGLD) for BONUS pool
  const eligible = table.filter(r => r.colsStaked > 0 && r.egldStaked > 0);
  const colsOnly = table.filter(r => r.colsStaked > 0 && !r.egldStaked);
  
  console.log("─".repeat(70));
  console.log("ELIGIBILITY:");
  console.log("─".repeat(70));
  console.log(`COLS Stakers (total):    ${colsStakers.length}`);
  console.log(`COLS + EGLD (bonus):     ${eligible.length}`);
  console.log(`COLS only (no EGLD):     ${colsOnly.length}`);
  console.log();

  if (eligible.length === 0) {
    console.error("ERROR: No eligible recipients for BONUS pool!");
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Calculate pools (SAME AS DAPP - using LIVE serviceFee)
  // ════════════════════════════════════════════════════════════════════════════
  const baseCorrected = apr / (1 - serviceFee) / 100;
  
  // Total daily buyback in COLS (using LIVE serviceFee)
  const totalDailyBuyback = (locked * baseCorrected * AGENCY_BUYBACK * serviceFee * egldPrice) / colsPrice / 365;
  
  // Split into pools
  const daoPool = totalDailyBuyback * DAO_DISTRIBUTION_RATIO;
  const bonusPool = totalDailyBuyback * BONUS_BUYBACK_FACTOR;
  
  console.log("─".repeat(70));
  console.log("DAILY DISTRIBUTION POOLS:");
  console.log("─".repeat(70));
  console.log(`Total Daily Buyback: ${totalDailyBuyback.toFixed(6)} COLS`);
  console.log(`DAO Pool (33.3%):    ${daoPool.toFixed(6)} COLS → ${colsStakers.length} COLS stakers`);
  console.log(`BONUS Pool (66.7%):  ${bonusPool.toFixed(6)} COLS → ${eligible.length} EGLD+COLS stakers`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // BONUS Pool distribution (binary search for APR max, like dapp)
  // ════════════════════════════════════════════════════════════════════════════
  const pE = egldPrice;
  const pC = colsPrice;
  
  // Calculate ratios and normalize
  let minRatio = Infinity, maxRatio = -Infinity;
  for (const r of eligible) {
    r.ratio = (r.colsStaked * pC) / (r.egldStaked * pE);
    if (r.ratio < minRatio) minRatio = r.ratio;
    if (r.ratio > maxRatio) maxRatio = r.ratio;
  }
  
  // Binary search for APR max to match target bonus pool
  let L = APR_MIN, R = 50, bestAprMax = 15;
  
  const calcBonusSum = (aprMax) => {
    let sum = 0;
    for (const r of eligible) {
      r.normalized = maxRatio !== minRatio ? (r.ratio - minRatio) / (maxRatio - minRatio) : 0;
      r.aprBonus = APR_MIN + (aprMax - APR_MIN) * Math.sqrt(r.normalized);
      sum += ((r.aprBonus / 100) * r.egldStaked * pE) / 365 / pC;
    }
    return sum;
  };
  
  for (let i = 0; i < 30; i++) {
    const mid = (L + R) / 2;
    const sum = calcBonusSum(mid);
    if (Math.abs(sum - bonusPool) < 0.001) { bestAprMax = mid; break; }
    sum < bonusPool ? (L = mid) : (R = mid);
    bestAprMax = mid;
  }
  
  // Final calculation
  calcBonusSum(bestAprMax);
  
  // Scale to exactly match bonus pool
  const calculatedBonusSum = eligible.reduce((s, r) => s + ((r.aprBonus / 100) * r.egldStaked * pE) / 365 / pC, 0);
  const bonusScale = bonusPool / calculatedBonusSum;
  
  for (const r of eligible) {
    r.dailyBonus = ((r.aprBonus / 100) * r.egldStaked * pE) / 365 / pC * bonusScale;
  }
  
  console.log(`APR Max (calculated): ${bestAprMax.toFixed(2)}%`);
  console.log(`Ratio range:          ${minRatio.toFixed(4)} - ${maxRatio.toFixed(4)}`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // DAO Pool distribution (proportional to COLS stake)
  // ════════════════════════════════════════════════════════════════════════════
  const sumCols = colsStakers.reduce((s, r) => s + r.colsStaked, 0);
  
  for (const r of colsStakers) {
    r.dailyDao = (daoPool * r.colsStaked) / sumCols;
  }
  
  const totalDaoDistributed = colsStakers.reduce((s, r) => s + r.dailyDao, 0);
  console.log(`DAO Pool distributed: ${totalDaoDistributed.toFixed(6)} COLS`);
  console.log();

  // ════════════════════════════════════════════════════════════════════════════
  // Sort and output
  // ════════════════════════════════════════════════════════════════════════════
  eligible.sort((a, b) => b.dailyBonus - a.dailyBonus);
  
  console.log("─".repeat(70));
  console.log("📋 TOP 20 BONUS RECIPIENTS:");
  console.log("─".repeat(70));
  
  for (let i = 0; i < Math.min(20, eligible.length); i++) {
    const r = eligible[i];
    const dao = colsStakers.find(s => s.address === r.address)?.dailyDao || 0;
    console.log(`${(i+1).toString().padStart(3)}. ${r.address}`);
    console.log(`     EGLD: ${r.egldStaked.toFixed(2).padStart(12)} | COLS: ${r.colsStaked.toFixed(2).padStart(12)}`);
    console.log(`     APR: ${r.aprBonus.toFixed(1)}% | Bonus: ${r.dailyBonus.toFixed(6)} COLS | DAO: ${dao.toFixed(6)} COLS`);
  }

  // Summary
  const totalBonusDistributed = eligible.reduce((s, r) => s + r.dailyBonus, 0);
  
  console.log();
  console.log("═".repeat(70));
  console.log("SUMMARY:");
  console.log("═".repeat(70));
  console.log();
  console.log("POOLS:");
  console.log(`  DAO Pool:     ${daoPool.toFixed(6)} COLS → ${colsStakers.length} recipients`);
  console.log(`  BONUS Pool:   ${bonusPool.toFixed(6)} COLS → ${eligible.length} recipients`);
  console.log(`  TOTAL:        ${(daoPool + bonusPool).toFixed(6)} COLS`);
  console.log();
  console.log("VERIFICATION:");
  console.log(`  DAO Distributed:    ${totalDaoDistributed.toFixed(6)} COLS (${((totalDaoDistributed/daoPool)*100).toFixed(1)}%)`);
  console.log(`  BONUS Distributed:  ${totalBonusDistributed.toFixed(6)} COLS (${((totalBonusDistributed/bonusPool)*100).toFixed(1)}%)`);
  console.log();
  console.log("PARAMETERS (ALL LIVE):");
  console.log(`  COLS Price:      $${colsPrice.toFixed(6)} (${colsSource})`);
  console.log(`  EGLD Price:      $${egldPrice.toFixed(4)} (${egldSource})`);
  console.log(`  Base APR:        ${apr.toFixed(2)}% (from API)`);
  console.log(`  Service Fee:     ${(serviceFee * 100).toFixed(1)}% (from API)`);
  console.log(`  Agency Locked:   ${locked.toLocaleString()} EGLD (from API)`);
  console.log();
  console.log("CONSTANTS (Business Logic):");
  console.log(`  Agency Buyback:  ${(AGENCY_BUYBACK * 100).toFixed(0)}%`);
  console.log(`  DAO Ratio:       ${(DAO_DISTRIBUTION_RATIO * 100).toFixed(1)}%`);
  console.log(`  Bonus Ratio:     ${(BONUS_BUYBACK_FACTOR * 100).toFixed(0)}%`);
  console.log(`  APR Max:         ${bestAprMax.toFixed(2)}% (calculated)`);
  
  // Save results
  const outputPath = '/tmp/distribution_list_v4.txt';
  const lines = [];
  
  // DAO recipients (all COLS stakers)
  lines.push('# DAO Pool Recipients (all COLS stakers)');
  for (const r of [...colsStakers].sort((a, b) => b.dailyDao - a.dailyDao)) {
    lines.push(`${r.address};${r.dailyDao.toFixed(6)};DAO`);
  }
  
  // BONUS recipients (EGLD+COLS)
  lines.push('');
  lines.push('# BONUS Pool Recipients (EGLD+COLS stakers)');
  for (const r of eligible) {
    lines.push(`${r.address};${r.dailyBonus.toFixed(6)};BONUS`);
  }
  
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`\n✅ Saved to ${outputPath}`);
  
  // Full JSON
  const jsonPath = '/tmp/distribution_full_v4.json';
  fs.writeFileSync(jsonPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    
    // All live data
    liveData: {
      colsStakers: { count: colsStakers.length, source: colsMode },
      egldDelegators: { count: Object.keys(egldMap).length, source: egldMode },
      colsPrice: { value: colsPrice, source: colsSource },
      egldPrice: { value: egldPrice, source: egldSource },
      apr: { value: apr, source: providerData.mode },
      serviceFee: { value: serviceFee, source: providerData.mode },
      locked: { value: locked, source: providerData.mode }
    },
    
    // Business logic constants
    constants: {
      agencyBuyback: AGENCY_BUYBACK,
      daoDistributionRatio: DAO_DISTRIBUTION_RATIO,
      bonusBuybackFactor: BONUS_BUYBACK_FACTOR,
      aprMin: APR_MIN,
      aprMax: bestAprMax
    },
    
    // Pools
    pools: {
      totalDailyBuyback,
      daoPool,
      bonusPool
    },
    
    // Recipients
    daoRecipients: [...colsStakers].sort((a, b) => b.dailyDao - a.dailyDao).map(r => ({
      address: r.address, colsStaked: r.colsStaked, dailyDao: r.dailyDao
    })),
    bonusRecipients: eligible.map(r => ({
      address: r.address, colsStaked: r.colsStaked, egldStaked: r.egldStaked,
      aprBonus: r.aprBonus, dailyBonus: r.dailyBonus,
      dailyDao: colsStakers.find(s => s.address === r.address)?.dailyDao || 0
    }))
  }, null, 2));
  console.log(`✅ Saved full data to ${jsonPath}`);
}

main().catch(console.error);
