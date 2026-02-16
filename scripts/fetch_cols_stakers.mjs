/**
 * Fetch COLS Stakers from PeerMe Smart Contract
 * 
 * Queries the PeerMe entity to get all COLS stakers with their stake amounts.
 * Saves to cache for use by daily_distribution.mjs
 * 
 * Usage: node fetch_cols_stakers.mjs
 */

import fs from 'fs';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { Address } from '@multiversx/sdk-core';

const CONFIG = {
  networkProvider: 'https://gateway.multiversx.com',
  claimContract: 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0',
  entityAddress: 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0',
  outputDir: '/tmp/cols_distribution',
};

async function main() {
  console.log('═'.repeat(60));
  console.log('📥 FETCHING COLS STAKERS');
  console.log('═'.repeat(60));
  console.log();
  
  const provider = new ProxyNetworkProvider(CONFIG.networkProvider);
  const claimAddress = new Address(CONFIG.claimContract);
  const entityAddress = new Address(CONFIG.entityAddress);
  
  console.log('Entity:', CONFIG.entityAddress);
  console.log('Claim Contract:', CONFIG.claimContract);
  console.log();
  
  try {
    // Approach 1: Query the claim contract for entity users
    console.log('Querying smart contract...');
    
    const response = await provider.queryContractRaw({
      contract: claimAddress,
      funcName: 'getEntityUsers',
      args: [entityAddress.hex()],
    });
    
    // Parse the response
    // The response is typically a list of (address, amount) pairs
    console.log('Raw response received');
    
    // Decode the response
    const stakers = parseStakersResponse(response);
    
    console.log(`Found ${stakers.length} COLS stakers`);
    
    // Save to cache
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    const outputFile = `${CONFIG.outputDir}/cols_stakers_latest.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      entity: CONFIG.entityAddress,
      totalStakers: stakers.length,
      totalStaked: stakers.reduce((s, e) => s + e.colsStake, 0),
      stakers,
    }, null, 2));
    
    console.log(`\n✅ Saved to: ${outputFile}`);
    
    // Print top stakers
    console.log('\nTop 10 COLS Stakers:');
    const sorted = [...stakers].sort((a, b) => b.colsStake - a.colsStake);
    for (let i = 0; i < 10 && i < sorted.length; i++) {
      console.log(`  ${i + 1}. ${sorted[i].address.slice(0, 20)}... → ${sorted[i].colsStake.toFixed(0)} COLS`);
    }
    
    return stakers;
    
  } catch (e) {
    console.log('Smart contract query failed, trying alternative methods...');
    console.log(`Error: ${e.message}`);
    
    // Alternative: Fetch from PeerMe API or external source
    return await fetchFromAlternativeSource();
  }
}

function parseStakersResponse(response) {
  const stakers = [];
  
  // The response format depends on the contract implementation
  // Typically it's an array of pairs encoded as: [address_len, address_bytes, amount_bytes]
  
  if (!response || !response.data) {
    return stakers;
  }
  
  try {
    // Decode based on actual contract response format
    // This may need adjustment based on the actual contract
    
    const data = response.data;
    let offset = 0;
    
    while (offset < data.length) {
      // Read address (32 bytes = 64 hex chars)
      const addressHex = data.slice(offset, offset + 64);
      if (addressHex.length < 64) break;
      
      const address = new Address(Buffer.from(addressHex, 'hex')).bech32();
      offset += 64;
      
      // Read amount (BigInt, 32 bytes = 64 hex chars for big uint)
      const amountHex = data.slice(offset, offset + 32);
      if (amountHex.length < 32) break;
      
      const amount = BigInt('0x' + amountHex);
      offset += 32;
      
      stakers.push({
        address,
        colsStake: Number(amount) / 1e18,
      });
    }
  } catch (e) {
    console.log('Parse error:', e.message);
  }
  
  return stakers;
}

async function fetchFromAlternativeSource() {
  console.log('\n📡 Using alternative data source...');
  
  // Option 1: PeerMe API (if available)
  // Option 2: External indexer
  // Option 3: Manual provision
  
  const stakersFile = '/home/raspberry/.openclaw/workspace/colombia-staking-dapp/data/cols_stakers.json';
  
  if (fs.existsSync(stakersFile)) {
    const data = JSON.parse(fs.readFileSync(stakersFile, 'utf-8'));
    console.log(`Loaded ${data.length} stakers from ${stakersFile}`);
    
    // Save to cache
    const outputFile = `${CONFIG.outputDir}/cols_stakers_latest.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      source: 'file',
      totalStakers: data.length,
      totalStaked: data.reduce((s, e) => s + e.colsStake, 0),
      stakers: data,
    }, null, 2));
    
    console.log(`✅ Saved to: ${outputFile}`);
    return data;
  }
  
  console.log('❌ No alternative data source available');
  console.log('Please provide COLS stakers data manually.');
  console.log('\nExpected format:');
  console.log('[{"address": "erd1...", "colsStake": 100.5}, ...]');
  
  return [];
}

main().catch(console.error);