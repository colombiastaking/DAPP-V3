#!/usr/bin/env node
/**
 * Fetch COLS Stakers via Smart Contract Query
 * 
 * Queries the PeerMe contract to get all COLS stakers.
 * This is the authoritative source - same as the DAPP uses.
 * 
 * Usage: node fetch_cols_stakers.mjs [--force]
 */

import { Address } from '@multiversx/sdk-core';
import fs from 'fs';

const CONFIG = {
  gateway: 'https://gateway.multiversx.com',
  colsContract: 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0',
  entityAddress: 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0',
  outputDir: '/tmp/cols_distribution',
};

// Entity address as 32 bytes (padded)
const ENTITY_HEX = '00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787';

/**
 * Fetch via gateway VM values query
 */
async function fetchFromGateway() {
  console.log('Querying PeerMe smart contract via gateway...');
  
  const response = await fetch(`${CONFIG.gateway}/vm-values/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scAddress: CONFIG.colsContract,
      funcName: 'getEntityUsers',
      args: [ENTITY_HEX]
    })
  });
  
  if (!response.ok) {
    throw new Error(`Gateway error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  const returnData = data?.data?.data?.returnData;
  if (!returnData || !Array.isArray(returnData)) {
    throw new Error('No return data from SC');
  }
  
  console.log(`  Received ${returnData.length} data parts`);
  return returnData;
}

/**
 * Parse the return data into address/amount pairs
 */
function parseReturnData(returnData) {
  const stakers = [];
  
  for (let i = 0; i < returnData.length && i + 1 < returnData.length; i += 2) {
    try {
      const addrBase64 = returnData[i];
      const amountBase64 = returnData[i + 1];
      
      if (!addrBase64 || !amountBase64) continue;
      
      // Decode base64 to buffer
      const addrBuffer = Buffer.from(addrBase64, 'base64');
      const amountBuffer = Buffer.from(amountBase64, 'base64');
      
      // Convert to address
      const addr = new Address(addrBuffer);
      const bech32Addr = addr.toBech32();
      
      // Parse amount
      const amountHex = amountBuffer.toString('hex');
      const amountBigInt = BigInt('0x' + amountHex);
      const colsStake = Number(amountBigInt) / 1e18;
      
      if (colsStake > 0) {
        stakers.push({
          address: bech32Addr,
          colsStake: colsStake
        });
      }
    } catch (e) {
      // Skip invalid entries
      console.log(`  Warning: Skipped entry ${i}: ${e.message}`);
    }
  }
  
  return stakers;
}

/**
 * Main function
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('📥 FETCHING COLS STAKERS (via Smart Contract)');
  console.log('═'.repeat(60));
  console.log();
  
  const force = process.argv.includes('--force');
  
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  let stakers = [];
  let source = 'unknown';
  
  // Try to fetch from SC
  try {
    const returnData = await fetchFromGateway();
    stakers = parseReturnData(returnData);
    source = 'smart-contract';
    console.log(`  ✅ Successfully parsed ${stakers.length} stakers from SC`);
  } catch (e) {
    console.log(`  ❌ SC query failed: ${e.message}`);
    console.log('  Falling back to cached data...');
    source = 'cache-fallback';
  }
  
  // If SC failed or returned empty, try cache
  if (stakers.length === 0) {
    const cacheFile = `${CONFIG.outputDir}/cols_stakers_latest.json`;
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      stakers = Array.isArray(cached) ? cached : (cached.stakers || []);
      source = 'cache';
      console.log(`  ✅ Loaded ${stakers.length} stakers from cache`);
    } else {
      console.log('  ❌ No cached data available');
      process.exit(1);
    }
  }
  
  // Sort by stake amount descending
  stakers.sort((a, b) => b.colsStake - a.colsStake);
  
  // Save to cache
  const cacheFile = `${CONFIG.outputDir}/cols_stakers_latest.json`;
  const cacheData = {
    timestamp: new Date().toISOString(),
    count: stakers.length,
    source: source,
    stakers: stakers
  };
  
  fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
  console.log(`  💾 Saved to ${cacheFile}`);
  
  // Also save with date
  const dateFile = `${CONFIG.outputDir}/cols_stakers_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(dateFile, JSON.stringify(cacheData, null, 2));
  
  console.log();
  console.log('📊 Summary:');
  console.log(`   Total stakers: ${stakers.length}`);
  console.log(`   Total COLS staked: ${stakers.reduce((s, u) => s + u.colsStake, 0).toFixed(2)}`);
  console.log(`   Source: ${source}`);
  console.log();
  
  if (stakers.length > 0) {
    console.log('Top 5 stakers:');
    stakers.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.address.slice(0, 20)}... -> ${s.colsStake.toFixed(2)} COLS`);
    });
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
