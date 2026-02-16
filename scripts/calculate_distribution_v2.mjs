import * as fs from "fs";

// Configuration - SAME AS DAPP
const PEERME_COLS_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";
const PEERME_ENTITY_ADDRESS = "erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0";
const DELEGATION_CONTRACT = "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf";

const PRIMARY_PROVIDER_API = `https://staking.colombia-staking.com/mvx-api/providers/${DELEGATION_CONTRACT}`;
const BACKUP_PROVIDER_API = `https://api.multiversx.com/providers/${DELEGATION_CONTRACT}`;

const GATEWAY = "https://gateway.multiversx.com";

// Constants from dapp
const AGENCY_BUYBACK = 0.30;
const DAO_DISTRIBUTION_RATIO = 0.333;
const BONUS_BUYBACK_FACTOR = 0.66;
const APR_MIN = 0.5;

/* ───────────────────────────────────────────────
   BECH32 UTILS
──────────────────────────────────────────────────*/
function bech32Decode(bech32Str) {
  const charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const lastOne = bech32Str.lastIndexOf('1');
  const data = bech32Str.slice(lastOne + 1);
  const decoded = [];
  for (const c of data) {
    decoded.push(charset.indexOf(c));
  }
  // Remove checksum (last 6)
  const values = decoded.slice(0, -6);
  // Convert from 5-bit to 8-bit
  let acc = 0, bits = 0;
  const result = [];
  for (const d of values) {
    acc = (acc << 5) | d;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      result.push((acc >> bits) & 0xff);
    }
  }
  return Buffer.from(result).toString('hex');
}

function bech32Encode(hexStr) {
  const charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  const data = [];
  for (let i = 0; i < hexStr.length; i += 2) {
    data.push(parseInt(hexStr.substr(i, 2), 16));
  }
  // Convert to 5-bit
  const acc = [];
  let bits = 0, value = 0;
  for (const d of data) {
    value = (value << 8) | d;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      acc.push((value >> bits) & 31);
    }
  }
  if (bits > 0) acc.push((value << (5 - bits)) & 31);
  // Checksum
  const generator = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const values = [...acc, 0, 0, 0, 0, 0, 0];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= generator[i];
    }
  }
  const checksum = [];
  for (let i = 0; i < 6; i++) {
    checksum.push((chk >> (5 * (5 - i))) & 31);
  }
  const combined = [...acc, ...checksum];
  return "erd1" + combined.map(i => charset[i]).join("");
}

/* ───────────────────────────────────────────────
   PRICE FETCHING (SAME AS DAPP)
──────────────────────────────────────────────────*/
async function fetchEgldPrice() {
  try {
    const r = await fetch("https://api.multiversx.com/economics");
    const data = await r.json();
    return Number(data.price) || 0;
  } catch {
    return 0;
  }
}

async function fetchColsPrice() {
  try {
    const r = await fetch("https://api.multiversx.com/accounts/erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm/tokens?identifier=COLS-9d91b7");
    const data = await r.json();
    return Number(data?.[0]?.price ?? 0);
  } catch {
    return 0;
  }
}

async function fetchProviderData() {
  try {
    const r = await fetch(`${PRIMARY_PROVIDER_API}`);
    const data = await r.json();
    return {
      apr: data?.apr ?? 0,
      locked: data?.locked ? Number(data.locked) / 1e18 : 0,
      serviceFee: 0.10
    };
  } catch {
    const r = await fetch(`${BACKUP_PROVIDER_API}`);
    const data = await r.json();
    return {
      apr: data?.apr ?? 0,
      locked: data?.locked ? Number(data.locked) / 1e18 : 0,
      serviceFee: 0.10
    };
  }
}

/* ───────────────────────────────────────────────
   COLS STAKERS (FROM SMART CONTRACT - SAME AS DAPP)
──────────────────────────────────────────────────*/
async function fetchColsStakers() {
  // Convert entity address to hex
  const entityHex = bech32Decode(PEERME_ENTITY_ADDRESS);
  
  const url = `${GATEWAY}/vm-values/query`;
  const payload = {
    scAddress: PEERME_COLS_CONTRACT,
    funcName: "getEntityUsers",
    args: [entityHex]
  };
  
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    
    const returnData = data?.data?.data?.returnData;
    if (!returnData || !Array.isArray(returnData)) {
      console.error("Invalid response:", JSON.stringify(data).substring(0, 200));
      return [];
    }
    
    const stakers = [];
    for (let i = 0; i < returnData.length; i += 2) {
      const addrHex = Buffer.from(returnData[i], 'base64').toString('hex');
      const amountHex = Buffer.from(returnData[i + 1], 'base64').toString('hex');
      
      const addr = bech32Encode(addrHex);
      const amount = parseInt(amountHex, 16) / 1e18;
      
      stakers.push({
        address: addr,
        colsStaked: amount
      });
    }
    return stakers;
  } catch (e) {
    console.error("Error fetching COLS stakers:", e);
    return [];
  }
}

/* ───────────────────────────────────────────────
   EGLD STAKES (BULK FETCH FROM PROVIDER - SAME AS DAPP)
──────────────────────────────────────────────────*/
async function fetchEgldBulk(addresses) {
  const url = `${PRIMARY_PROVIDER_API}/accounts?size=10000`;
  try {
    const r = await fetch(url);
    const data = await r.json();
    
    const map = {};
    // Response is a list directly, not {accounts: [...]}
    const accounts = Array.isArray(data) ? data : (data.accounts || []);
    for (const a of accounts) {
      const v = Number(a.activeStake || a.delegationActiveStake || a.stake || 0);
      map[a.address] = v > 1e12 ? v / 1e18 : v;
    }
    
    // Also check how many of our addresses are in the map
    const found = addresses.filter(a => map[a] > 0).length;
    console.log(`Found EGLD stakes for ${found}/${addresses.length} COLS stakers`);
    
    return map;
  } catch (e) {
    console.error("Error fetching EGLD bulk:", e);
    return {};
  }
}

/* ───────────────────────────────────────────────
   MAIN CALCULATION (SAME LOGIC AS DAPP)
──────────────────────────────────────────────────*/
async function main() {
  console.log("=".repeat(70));
  console.log("📊 COLS DAILY DISTRIBUTION CALCULATOR (v2 - Dapp Logic)");
  console.log("=".repeat(70));
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log();

  // Fetch all data in parallel
  console.log("Fetching prices and provider data...");
  const [egldPrice, colsPrice, providerData] = await Promise.all([
    fetchEgldPrice(),
    fetchColsPrice(),
    fetchProviderData()
  ]);
  
  console.log(`EGLD Price: $${egldPrice.toFixed(4)}`);
  console.log(`COLS Price: $${colsPrice.toFixed(6)}`);
  console.log(`Base APR: ${providerData.apr.toFixed(2)}%`);
  console.log(`Agency Locked EGLD: ${providerData.locked.toLocaleString()}`);
  console.log();

  // Fetch COLS stakers from smart contract
  console.log("Fetching COLS stakers from smart contract...");
  const colsStakers = await fetchColsStakers();
  console.log(`Found ${colsStakers.length} COLS stakers`);
  
  if (colsStakers.length === 0) {
    console.error("ERROR: No COLS stakers found.");
    return;
  }

  // Fetch EGLD stakes for COLS stakers only (SAME AS DAPP!)
  console.log("Fetching EGLD stakes for those COLS stakers...");
  const egldMap = await fetchEgldBulk(colsStakers.map(s => s.address));
  
  // Count how many have EGLD staked
  const withEgld = colsStakers.filter(s => (egldMap[s.address] || 0) > 0).length;
  console.log(`COLS stakers with EGLD: ${withEgld}`);
  
  // Build table with BOTH COLS and EGLD (SAME AS DAPP)
  const table = colsStakers.map(s => ({
    address: s.address,
    colsStaked: s.colsStaked,
    egldStaked: egldMap[s.address] || 0
  }));
  
  // Filter to only those with both (SAME AS DAPP)
  const eligible = table.filter(r => r.colsStaked > 0 && r.egldStaked > 0);
  console.log(`Eligible for BONUS APR (COLS + EGLD): ${eligible.length}`);
  console.log();

  // Calculate ratios (SAME AS DAPP)
  const pE = egldPrice;
  const pC = colsPrice;
  const aprBase = providerData.apr;
  const locked = providerData.locked;
  const serviceFee = providerData.serviceFee;
  
  // Calculate target average daily bonus (SAME FORMULA AS DAPP)
  const baseCorrected = aprBase / (1 - serviceFee) / 100;
  const targetAvgDaily = (locked * baseCorrected * AGENCY_BUYBACK * serviceFee * BONUS_BUYBACK_FACTOR * pE) / pC / 365;
  
  console.log(`Target daily bonus pool: ${targetAvgDaily.toFixed(6)} COLS`);
  
  // Calculate ratios and normalize (SAME AS DAPP)
  let minRatio = Infinity, maxRatio = -Infinity;
  for (const r of eligible) {
    r.ratio = (r.colsStaked * pC) / (r.egldStaked * pE);
    if (r.ratio < minRatio) minRatio = r.ratio;
    if (r.ratio > maxRatio) maxRatio = r.ratio;
  }
  
  console.log(`Ratio range: ${minRatio.toFixed(4)} - ${maxRatio.toFixed(4)}`);
  
  // Binary search for aprMax (SAME AS DAPP)
  let L = 0.5, R = 50, best = 15;
  const calc = (mx) => {
    let sum = 0;
    for (const r of eligible) {
      r.normalized = maxRatio !== minRatio ? (r.ratio - minRatio) / (maxRatio - minRatio) : 0;
      r.aprBonus = APR_MIN + (mx - APR_MIN) * Math.sqrt(r.normalized);
      sum += ((r.aprBonus / 100) * r.egldStaked * pE) / 365 / pC;
    }
    return sum;
  };
  
  for (let i = 0; i < 30; i++) {
    const mid = (L + R) / 2;
    const sum = calc(mid);
    if (Math.abs(sum - targetAvgDaily) < 0.001) { best = mid; break; }
    sum < targetAvgDaily ? (L = mid) : (R = mid);
    best = mid;
  }
  
  // Final calculation with best aprMax
  calc(best);
  
  console.log(`Calculated APR max: ${best.toFixed(2)}%`);
  console.log();
  
  // Calculate daily COLS for each
  for (const r of eligible) {
    r.dailyCols = ((r.aprBonus / 100) * r.egldStaked * pE) / 365 / pC;
  }
  
  // Sort by daily COLS
  eligible.sort((a, b) => b.dailyCols - a.dailyCols);
  
  // Calculate total
  const totalDaily = eligible.reduce((s, r) => s + r.dailyCols, 0);
  
  // DAO pool calculation (SAME AS DAPP)
  const sumCols = eligible.reduce((s, r) => s + r.colsStaked, 0);
  for (const r of eligible) {
    r.daoCols = ((locked * baseCorrected * AGENCY_BUYBACK * serviceFee * DAO_DISTRIBUTION_RATIO * r.colsStaked) 
      / sumCols / r.egldStaked) * pE / 365 / pC;
  }
  
  const totalDao = eligible.reduce((s, r) => s + r.daoCols, 0);
  
  console.log("-".repeat(70));
  console.log("📋 TOP 20 BONUS RECIPIENTS:");
  console.log("-".repeat(70));
  
  for (let i = 0; i < Math.min(20, eligible.length); i++) {
    const r = eligible[i];
    console.log(`${(i+1).toString().padStart(3)}. ${r.address}`);
    console.log(`     EGLD: ${r.egldStaked.toFixed(2).padStart(12)} | COLS: ${r.colsStaked.toFixed(2).padStart(12)} | Ratio: ${r.ratio.toFixed(3)}`);
    console.log(`     APR Bonus: ${r.aprBonus.toFixed(1)}% | Daily: ${r.dailyCols.toFixed(6)} COLS (bonus) + ${r.daoCols.toFixed(6)} COLS (dao)`);
  }
  
  console.log();
  console.log("-".repeat(70));
  console.log("SUMMARY:");
  console.log("-".repeat(70));
  console.log(`COLS Stakers (total): ${colsStakers.length}`);
  console.log(`COLS Stakers with EGLD delegated: ${withEgld}`);
  console.log(`EGLD+COLS Eligible for BONUS: ${eligible.length}`);
  console.log();
  console.log(`Total Daily BONUS Pool: ${totalDaily.toFixed(6)} COLS`);
  console.log(`Total Daily DAO Pool: ${totalDao.toFixed(6)} COLS`);
  console.log(`Total Daily Distribution: ${(totalDaily + totalDao).toFixed(6)} COLS`);
  console.log();
  console.log(`COLS Price: $${colsPrice.toFixed(6)}`);
  console.log(`EGLD Price: $${egldPrice.toFixed(4)}`);
  console.log(`Base APR: ${aprBase.toFixed(2)}%`);
  console.log(`APR Max (calculated): ${best.toFixed(2)}%`);
  console.log(`Agency Locked EGLD: ${locked.toLocaleString()}`);
  
  // Save results
  const outputPath = '/tmp/distribution_list_v2.txt';
  fs.writeFileSync(outputPath, eligible.map(r => 
    `${r.address};${r.dailyCols.toFixed(6)};${r.daoCols.toFixed(6)}`
  ).join('\n'));
  console.log(`\n✅ Saved ${eligible.length} recipients to ${outputPath}`);
  
  // Also save full JSON
  const jsonPath = '/tmp/distribution_full_v2.json';
  fs.writeFileSync(jsonPath, JSON.stringify({
    date: new Date().toISOString().split('T')[0],
    colsPrice,
    egldPrice,
    baseApr: aprBase,
    aprMax: best,
    agencyLockedEgld: locked,
    totalDailyBonus: totalDaily,
    totalDailyDao: totalDao,
    totalDaily: totalDaily + totalDao,
    colsStakersTotal: colsStakers.length,
    colsStakersWithEgld: withEgld,
    bonusEligible: eligible.length,
    stakers: eligible
  }, null, 2));
  console.log(`✅ Saved full data to ${jsonPath}`);
}

main().catch(console.error);
