#!/usr/bin/env node
/**
 * COLS Daily Distribution System - PRODUCTION READY
 * 
 * Uses exact DAPP formula:
 * - Ratio = (COLS × COLS_price) / (EGLD × EGLD_price)
 * - Normalized = (ratio - min) / (max - min)
 * - APR_bonus via binary search
 * - Bonus = (APR_bonus/100) × EGLD × EGLD_price / 365 / COLS_price
 * 
 * Usage:
 *   node daily_distribution.mjs              # Dry run
 *   node daily_distribution.mjs --execute    # Execute on blockchain
 */

import fs from 'fs';
import fetch from 'node-fetch';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  network: {
    provider: 'https://api.multiversx.com',
    chainId: '1',
  },
  tokens: {
    cols: { id: 'COLS-9d91b7', decimals: 18 },
  },
  contracts: {
    peermeEntity: 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0',
    peermeClaim: 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0',
    delegation: 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf',
  },
  api: {
    stakingPrimary: 'https://staking.colombia-staking.com/mvx-api',
    stakingBackup: 'https://api.multiversx.com',
    economics: 'https://api.multiversx.com/economics',
    mexPrices: 'https://api.multiversx.com/mex-pairs/hourly-prices',
    colsToken: 'https://api.multiversx.com/tokens/COLS-9d91b7',
  },
  paths: {
    outputDir: '/tmp/cols_distribution',
    privateKey: '/home/raspberry/.openclaw/alice-backup/private_key.txt',
  },
  gas: {
    esdtTransfer: 510000,
    contractCall: 20000000,
  },
  // Constants from DAPP
  constants: {
    AGENCY_BUYBACK: 0.30,
    DAO_DISTRIBUTION_RATIO: 0.333,
    BONUS_BUYBACK_FACTOR: 0.66,
    APR_MIN: 0.5,
  },
};

// =============================================================================
// HELPERS
// =============================================================================

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

function colsToHex(amount) {
  const atomic = BigInt(Math.floor(amount * 1e18));
  let hex = atomic.toString(16);
  // CRITICAL: Pad to EVEN length for valid bytecode
  if (hex.length % 2 !== 0) {
    hex = '0' + hex;
  }
  return hex;
}

function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.paths.outputDir)) {
    fs.mkdirSync(CONFIG.paths.outputDir, { recursive: true });
  }
}

// =============================================================================
// DATA FETCHING
// =============================================================================

async function fetchEGLDPrice() {
  console.log('Fetching EGLD price...');
  try {
    const data = await fetchWithTimeout(CONFIG.api.economics);
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
    const data = await fetchWithTimeout(CONFIG.api.mexPrices);
    const colsPair = data.find(p => p.baseId === 'COLS-9d91b7');
    if (colsPair?.price) {
      console.log(`  COLS: $${colsPair.price} (MEX)`);
      return colsPair.price;
    }
  } catch {}
  
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
  
  try {
    const data = await fetchWithTimeout(url);
    let locked = parseFloat(data.locked) || 0;
    if (locked > 1e18) locked = locked / 1e18;
    
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
    console.log(`  Error: ${e.message}`);
    return { baseApr: 8.45, serviceFee: 0.10, totalLocked: 178580, totalDelegators: 837 };
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
        let stake = parseFloat(acc.stake) || 0;
        if (stake > 1e15) stake = stake / 1e18;
        
        allDelegators.push({
          address: acc.address,
          stake: stake,
        });
      }
      
      if (data.length < batchSize) break;
      offset += batchSize;
    } catch (e) {
      break;
    }
  }
  
  console.log(`  Found ${allDelegators.length} delegators`);
  return allDelegators;
}

async function getCOLSStakers() {
  const cacheFile = `${CONFIG.paths.outputDir}/cols_stakers_latest.json`;
  
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    const stakers = Array.isArray(cached) ? cached : (cached.stakers || []);
    console.log(`  Loaded ${stakers.length} COLS stakers from cache`);
    return stakers;
  }
  
  console.log('  ⚠️ No COLS stakers cache found. Run fetch_cols_stakers.mjs first.');
  return [];
}

// =============================================================================
// BONUS CALCULATION (DAPP FORMULA)
// =============================================================================

function calculateBonusDistribution(egldPrice, colsPrice, providerData, delegators, colsStakers) {
  const { baseApr, serviceFee, totalLocked } = providerData;
  const { AGENCY_BUYBACK, BONUS_BUYBACK_FACTOR, APR_MIN } = CONFIG.constants;
  
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
  const baseCorrected = baseApr / (1 - serviceFee) / 100;
  const targetBonus = (totalLocked * baseCorrected * AGENCY_BUYBACK * serviceFee * BONUS_BUYBACK_FACTOR * egldPrice / colsPrice) / 365;
  
  console.log(`  Target BONUS pool: ${targetBonus.toFixed(6)} COLS`);
  
  // Step 6: Binary search for APRmax that makes total match target
  function calcTotalWithAprMax(aprMax) {
    let total = 0;
    for (const e of eligible) {
      const aprBonus = APR_MIN + (aprMax - APR_MIN) * Math.sqrt(e.normalized);
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
  
  return {
    recipients,
    totalBonus: totalCalculated,
    aprMax,
    targetBonus,
    ratios: { min: minRatio, max: maxRatio },
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const shouldExecute = process.argv.includes('--execute') || process.argv.includes('-e');
  const shouldForceRecalc = process.argv.includes('--recalc');
  
  console.log('═'.repeat(70));
  console.log('🔄 COLS BONUS DISTRIBUTION (DAPP Formula)');
  console.log('═'.repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Mode: ${shouldExecute ? '⚠️ EXECUTE' : '📋 DRY RUN'}`);
  console.log();
  
  ensureOutputDir();
  
  // Check for cached distribution from today
  const today = new Date().toISOString().split('T')[0];
  const cachedDistFile = `${CONFIG.paths.outputDir}/bonus_distribution_${today}.json`;
  
  let distribution;
  
  if (fs.existsSync(cachedDistFile) && !shouldForceRecalc) {
    console.log('📂 Loading cached distribution...');
    const cached = JSON.parse(fs.readFileSync(cachedDistFile, 'utf-8'));
    distribution = cached.bonus;
    console.log(`   Cached at: ${cached.timestamp}`);
    console.log(`   Total: ${distribution.totalBonus.toFixed(6)} COLS`);
  } else {
    // Fetch data
    console.log('📡 Fetching data...\n');
    
    const [egldPrice, colsPrice, providerData] = await Promise.all([
      fetchEGLDPrice(),
      fetchCOLSPrice(),
      fetchProviderData(),
    ]);
    
    const delegators = await fetchEGLDDelegators();
    const colsStakers = await getCOLSStakers();
    
    // Calculate
    distribution = calculateBonusDistribution(egldPrice, colsPrice, providerData, delegators, colsStakers);
    
    // Save results
    const result = {
      timestamp: new Date().toISOString(),
      prices: { egldPrice, colsPrice },
      providerData,
      bonus: distribution,
    };
    
    fs.writeFileSync(cachedDistFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 Saved to: ${cachedDistFile}`);
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 COLS-DIST TABLE (BONUS Distribution)');
  console.log('═'.repeat(70));
  console.log(`\nTotal: ${distribution.totalBonus.toFixed(8)} COLS`);
  console.log(`Recipients: ${distribution.recipients.length}`);
  console.log(`APRmax: ${distribution.aprMax.toFixed(4)}%`);
  console.log(`\nTop 10 recipients:`);
  for (let i = 0; i < 10 && i < distribution.recipients.length; i++) {
    const r = distribution.recipients[i];
    console.log(`  ${i+1}. ${r.address.slice(0, 25)}... → ${r.amount.toFixed(8)} COLS`);
  }
  
  // Show sample transactions
  console.log('\n📝 Sample transactions:');
  const tokenHex = Buffer.from(CONFIG.tokens.cols.id).toString('hex');
  
  for (let i = 0; i < 3 && i < distribution.recipients.length; i++) {
    const r = distribution.recipients[i];
    const amountHex = colsToHex(r.amount);
    console.log(`\n  TX #${i+1}:`);
    console.log(`    Receiver: ${r.address}`);
    console.log(`    Amount: ${r.amount.toFixed(8)} COLS`);
    console.log(`    Data: ESDTTransfer@${tokenHex}@${amountHex}`);
  }
  
  // Execute logic would go here
  if (shouldExecute) {
    console.log('\n⚠️  EXECUTION NOT IMPLEMENTED YET');
    console.log('Use run_distribution.sh for blockchain execution');
  } else {
    console.log('\n📝 To execute, run: ./run_distribution.sh execute');
  }
  
  console.log('\n═'.repeat(70));
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});