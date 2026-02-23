#!/usr/bin/env node
/**
 * COLS BONUS Distribution Calculator - Match DAPP Formula
 * 
 * This script calculates the BONUS distribution matching the DAPP formula exactly.
 * Uses binary search to find APRmax that makes total match target.
 */

import fs from 'fs';

// Constants (same as DAPP)
const AGENCY_BUYBACK = 0.30;
const DAO_DISTRIBUTION_RATIO = 0.333;
const BONUS_BUYBACK_FACTOR = 0.66;
const APR_MIN = 0.5;

// Configuration - Triple redundancy
const CONFIG = {
  api: {
    // Provider data: Local (primary) → Public (backup)
    providerPrimary: 'http://192.168.0.120',
    providerBackup: 'https://api.multiversx.com',
    // Prices: Public (primary) → Local (backup)
    economicsPrimary: 'https://api.multiversx.com/economics',
    economicsBackup: 'http://192.168.0.120/economics',
    mexPrices: 'https://api.multiversx.com/mex-pairs/hourly-prices',
    colsTokenPrimary: 'https://api.multiversx.com/tokens/COLS-9d91b7',
    colsTokenBackup: 'http://192.168.0.120/tokens/COLS-9d91b7',
  },
  contracts: {
    claim: 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0',
    entity: 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0',
    delegation: 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf',
  },
  paths: {
    outputDir: '/tmp/cols_distribution',
  },
};

// Helper: Fetch with timeout
async function fetchWithTimeout(url, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetch functions
async function fetchEGLDPrice() {
  console.log('Fetching EGLD price...');
  try {
    const data = await fetchWithTimeout(CONFIG.api.economicsPrimary);
    const price = parseFloat(data.price);
    console.log(`  EGLD: $${price}`);
    return price;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return 0;
  }
}

async function fetchCOLSPrice() {
  console.log('Fetching COLS price...');
  try {
    // Try MEX hourly prices first
    const data = await fetchWithTimeout(CONFIG.api.mexPrices);
    const colsPair = data.find(p => p.baseId === 'COLS-9d91b7');
    if (colsPair?.price) {
      console.log(`  COLS: $${colsPair.price} (MEX)`);
      return colsPair.price;
    }
  } catch {}
  
  // Fallback to token API
  try {
    const data = await fetchWithTimeout(CONFIG.api.colsToken);
    const price = parseFloat(data.price) || 0.15;
    console.log(`  COLS: $${price} (token API)`);
    return price;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return 0.15;
  }
}

async function fetchProviderData() {
  console.log('Fetching provider data...');
  
  const url = `${CONFIG.api.stakingPrimary}/providers/${CONFIG.contracts.delegation}`;
  const backupUrl = `${CONFIG.api.stakingBackup}/providers/${CONFIG.contracts.delegation}`;
  
  try {
    const data = await fetchWithTimeout(url);
    // Handle locked value - might be raw or normalized
    let locked = parseFloat(data.locked) || 0;
    if (locked > 1e18) locked = locked / 1e18; // Convert from wei
    
    const result = {
      baseApr: parseFloat(data.apr) || 8.45,
      serviceFee: parseFloat(data.serviceFee) || 0.10,
      totalLocked: locked,
      totalDelegators: data.numUsers || 0,
    };
    console.log(`  Base APR: ${result.baseApr}%`);
    console.log(`  Service Fee: ${result.serviceFee * 100}%`);
    console.log(`  Total Locked: ${result.totalLocked.toFixed(0)} EGLD`);
    return result;
  } catch (e) {
    const data = await fetchWithTimeout(backupUrl);
    let locked = parseFloat(data.locked) || 0;
    if (locked > 1e18) locked = locked / 1e18;
    
    const result = {
      baseApr: parseFloat(data.apr) || 8.45,
      serviceFee: 0.10,
      totalLocked: locked,
      totalDelegators: data.numUsers || 0,
    };
    console.log(`  Base APR: ${result.baseApr}% (backup)`);
    return result;
  }
}

async function fetchEGLDDelegators() {
  console.log('Fetching EGLD delegators...');
  
  const allDelegators = [];
  let offset = 0;
  const batchSize = 500;
  
  while (true) {
    const url = `${CONFIG.api.stakingPrimary}/providers/${CONFIG.contracts.delegation}/accounts?size=${batchSize}&from=${offset}`;
    
    try {
      const data = await fetchWithTimeout(url);
      if (!data || data.length === 0) break;
      
      for (const acc of data) {
        // Stake is in wei format (divide by 1e18)
        let stake = parseFloat(acc.stake) || 0;
        if (stake > 1e15) stake = stake / 1e18; // Convert from wei
        
        allDelegators.push({
          address: acc.address,
          stake: stake,
        });
      }
      
      if (data.length < batchSize) break;
      offset += batchSize;
    } catch (e) {
      // Try backup
      const backupUrl = `${CONFIG.api.stakingBackup}/providers/${CONFIG.contracts.delegation}/accounts?size=${batchSize}&from=${offset}`;
      const data = await fetchWithTimeout(backupUrl);
      if (!data || data.length === 0) break;
      
      for (const acc of data) {
        let stake = parseFloat(acc.stake) || 0;
        if (stake > 1e15) stake = stake / 1e18;
        
        allDelegators.push({
          address: acc.address,
          stake: stake,
        });
      }
      
      if (data.length < batchSize) break;
      offset += batchSize;
    }
  }
  
  console.log(`  Found ${allDelegators.length} delegators`);
  return allDelegators;
}

// Load COLS stakers from cache file
async function getCOLSStakers() {
  const cacheFile = `${CONFIG.paths.outputDir}/cols_stakers_latest.json`;
  
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    // Handle both formats: array or object with stakers array
    const stakers = Array.isArray(cached) ? cached : (cached.stakers || []);
    console.log(`  Loaded ${stakers.length} COLS stakers from cache`);
    return stakers;
  }
  
  console.log('  ⚠️ No COLS stakers cache found. Run fetch_cols_stakers.mjs first.');
  return [];
}

/**
 * MAIN BONUS CALCULATION - Matches DAPP formula exactly
 */
function calculateBonusDistribution(egldPrice, colsPrice, providerData, delegators, colsStakers) {
  const { baseApr, serviceFee, totalLocked } = providerData;
  
  console.log('\n📊 Calculating BONUS distribution (DAPP formula)...');
  
  // Step 1: Find addresses with BOTH EGLD and COLS stake
  const eligible = [];
  
  for (const d of delegators) {
    const colsStaker = colsStakers.find(s => s.address === d.address);
    if (colsStaker && d.stake > 0 && colsStaker.colsStake > 0) {
      eligible.push({
        address: d.address,
        egldStake: d.stake,
        colsStake: colsStaker.colsStake,
      });
    }
  }
  
  console.log(`  Eligible addresses (EGLD + COLS): ${eligible.length}`);
  
  if (eligible.length === 0) {
    return { recipients: [], totalBonus: 0, aprMax: 0 };
  }
  
  // Step 2: Calculate ratio for each address (DAPP formula)
  // ratio = (colsStaked * COLS_price) / (egldStaked * EGLD_price)
  for (const e of eligible) {
    e.ratio = (e.colsStake * colsPrice) / (e.egldStake * egldPrice);
  }
  
  // Step 3: Find min and max ratio
  const ratios = eligible.map(e => e.ratio);
  const minRatio = Math.min(...ratios);
  const maxRatio = Math.max(...ratios);
  
  console.log(`  Ratio range: ${minRatio.toFixed(4)} - ${maxRatio.toFixed(4)}`);
  
  // Step 4: Normalize ratios (0 to 1)
  for (const e of eligible) {
    if (maxRatio !== minRatio) {
      e.normalized = (e.ratio - minRatio) / (maxRatio - minRatio);
    } else {
      e.normalized = 0;
    }
  }
  
  // Step 5: Calculate target total bonus pool
  // targetBonus = (totalLocked * baseApr/(1-fee)/100 * fee * BUYBACK * BONUS_FACTOR * EGLD_price / COLS_price) / 365
  const baseCorrected = baseApr / (1 - serviceFee) / 100;
  const targetBonus = (totalLocked * baseCorrected * AGENCY_BUYBACK * serviceFee * BONUS_BUYBACK_FACTOR * egldPrice / colsPrice) / 365;
  
  console.log(`  Target BONUS pool: ${targetBonus.toFixed(6)} COLS`);
  
  // Step 6: Binary search for APRmax that makes total match target
  function calcTotalWithAprMax(aprMax) {
    let total = 0;
    for (const e of eligible) {
      const aprBonus = APR_MIN + (aprMax - APR_MIN) * Math.sqrt(e.normalized);
      // Daily COLS bonus = (aprBonus / 100) * egldStake * EGLD_price / 365 / COLS_price
      const dailyCols = (aprBonus / 100) * e.egldStake * egldPrice / 365 / colsPrice;
      total += dailyCols;
    }
    return total;
  }
  
  let left = APR_MIN;
  let right = 50;
  let aprMax = 15;
  
  for (let i = 0; i < 200; i++) {
    const mid = (left + right) / 2;
    const total = calcTotalWithAprMax(mid);
    const diff = total - targetBonus;
    
    if (Math.abs(diff) < 0.001) {
      aprMax = mid;
      break;
    }
    
    if (diff > 0) {
      right = mid;
    } else {
      left = mid;
    }
    aprMax = mid;
  }
  
  console.log(`  APRmax found: ${aprMax.toFixed(4)}%`);
  
  // Step 7: Calculate final amounts
  const recipients = [];
  let totalCalculated = 0;
  
  for (const e of eligible) {
    const aprBonus = APR_MIN + (aprMax - APR_MIN) * Math.sqrt(e.normalized);
    const dailyCols = (aprBonus / 100) * e.egldStake * egldPrice / 365 / colsPrice;
    
    recipients.push({
      address: e.address,
      amount: dailyCols,
      egldStake: e.egldStake,
      colsStake: e.colsStake,
      ratio: e.ratio,
      normalized: e.normalized,
      aprBonus: aprBonus,
    });
    
    totalCalculated += dailyCols;
  }
  
  // Sort by amount descending
  recipients.sort((a, b) => b.amount - a.amount);
  
  console.log(`  Total calculated: ${totalCalculated.toFixed(6)} COLS`);
  console.log(`  Difference from target: ${Math.abs(totalCalculated - targetBonus).toFixed(6)} COLS`);
  
  return {
    recipients,
    totalBonus: totalCalculated,
    aprMax,
    targetBonus,
    ratios: { min: minRatio, max: maxRatio },
  };
}

// Main
async function main() {
  console.log('═'.repeat(70));
  console.log('🔄 COLS BONUS DISTRIBUTION - DAPP FORMULA');
  console.log('═'.repeat(70));
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  // Ensure output dir exists
  if (!fs.existsSync(CONFIG.paths.outputDir)) {
    fs.mkdirSync(CONFIG.paths.outputDir, { recursive: true });
  }
  
  // Fetch data
  const [egldPrice, colsPrice, providerData] = await Promise.all([
    fetchEGLDPrice(),
    fetchCOLSPrice(),
    fetchProviderData(),
  ]);
  
  const delegators = await fetchEGLDDelegators();
  const colsStakers = await getCOLSStakers();
  
  // Calculate
  const bonus = calculateBonusDistribution(egldPrice, colsPrice, providerData, delegators, colsStakers);
  
  // Save results
  const result = {
    timestamp: new Date().toISOString(),
    prices: { egldPrice, colsPrice },
    providerData,
    bonus,
    stats: {
      totalDelegators: delegators.length,
      totalColsStakers: colsStakers.length,
      eligibleAddresses: bonus.recipients.length,
    }
  };
  
  const outputFile = `${CONFIG.paths.outputDir}/bonus_distribution_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
  
  console.log(`\n💾 Saved to: ${outputFile}`);
  
  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 BONUS DISTRIBUTION SUMMARY');
  console.log('═'.repeat(70));
  console.log(`\nTotal: ${bonus.totalBonus.toFixed(6)} COLS`);
  console.log(`Recipients: ${bonus.recipients.length}`);
  console.log(`APRmax: ${bonus.aprMax.toFixed(4)}%`);
  console.log(`\nTop 5 recipients:`);
  for (let i = 0; i < 5 && i < bonus.recipients.length; i++) {
    const r = bonus.recipients[i];
    console.log(`  ${i+1}. ${r.address.slice(0, 20)}... → ${r.amount.toFixed(6)} COLS`);
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});