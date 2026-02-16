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
import { Address, Query, ContractFunction, AddressValue, BigUIntValue, decodeBigNumber } from '@multiversx/sdk-core';

const CONFIG = {
  networkProvider: 'https://gateway.multiversx.com',
  // PeerMe COLS staking contract (claim contract)
  colsContract: 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0',
  // Colombia Staking entity address on PeerMe
  entityAddress: 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0',
  outputDir: '/tmp/cols_distribution',
};

async function main() {
  console.log('═'.repeat(60));
  console.log('📥 FETCHING COLS STAKERS');
  console.log('═'.repeat(60));
  console.log();
  
  const provider = new ProxyNetworkProvider(CONFIG.networkProvider);
  const colsAddress = new Address(CONFIG.colsContract);
  const entityAddress = new Address(CONFIG.entityAddress);
  
  console.log('Entity:', CONFIG.entityAddress);
  console.log('COLS Contract:', CONFIG.colsContract);
  console.log();
  
  try {
    // Query the PeerMe contract for entity users (COLS stakers)
    console.log('Querying PeerMe smart contract...');
    
    const query = new Query({
      address: colsAddress,
      func: new ContractFunction('getEntityUsers'),
      args: [new AddressValue(entityAddress)]
    });
    
    const response = await provider.queryContract(query);
    const returnData = response.getReturnDataParts();
    
    console.log(`Received ${returnData.length} data parts`);
    
    // Parse the response - pairs of (address, amount)
    const stakers = [];
    
    for (let i = 0; i < returnData.length; i += 2) {
      try {
        const addressBytes = returnData[i];
        const amountBytes = returnData[i + 1];
        
        if (addressBytes && amountBytes) {
          const address = new Address(addressBytes).bech32();
          const amount = Number(decodeBigNumber(amountBytes)) / 1e18;
          
          stakers.push({
            address,
            colsStake: amount,
          });
        }
      } catch (parseError) {
        // Skip invalid entries
      }
    }
    
    console.log(`Found ${stakers.length} COLS stakers`);
    
    if (stakers.length === 0) {
      throw new Error('No stakers found in contract response');
    }
    
    // Save to cache
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    const totalStaked = stakers.reduce((s, e) => s + e.colsStake, 0);
    
    const outputFile = `${CONFIG.outputDir}/cols_stakers_latest.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      entity: CONFIG.entityAddress,
      contract: CONFIG.colsContract,
      totalStakers: stakers.length,
      totalStaked: totalStaked,
      stakers,
    }, null, 2));
    
    console.log(`\n✅ Saved to: ${outputFile}`);
    console.log(`   Total COLS staked: ${totalStaked.toLocaleString()}`);
    
    // Print top stakers
    console.log('\n🏆 Top 10 COLS Stakers:');
    const sorted = [...stakers].sort((a, b) => b.colsStake - a.colsStake);
    for (let i = 0; i < 10 && i < sorted.length; i++) {
      console.log(`  ${i + 1}. ${sorted[i].address.slice(0, 12)}...${sorted[i].address.slice(-6)} → ${sorted[i].colsStake.toLocaleString()} COLS`);
    }
    
    return stakers;
    
  } catch (e) {
    console.log('❌ Smart contract query failed');
    console.log(`Error: ${e.message}`);
    
    // Try alternative source
    return await fetchFromAlternativeSource();
  }
}

async function fetchFromAlternativeSource() {
  console.log('\n📡 Trying alternative data source...');
  
  // Check for manually provided data
  const stakersFile = '/home/raspberry/.openclaw/workspace/colombia-staking-dapp/data/cols_stakers.json';
  
  if (fs.existsSync(stakersFile)) {
    const data = JSON.parse(fs.readFileSync(stakersFile, 'utf-8'));
    console.log(`Loaded ${data.length} stakers from ${stakersFile}`);
    
    // Save to cache
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
    
    const outputFile = `${CONFIG.outputDir}/cols_stakers_latest.json`;
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      source: 'file',
      entity: CONFIG.entityAddress,
      totalStakers: data.length,
      totalStaked: data.reduce((s, e) => s + e.colsStake, 0),
      stakers: data,
    }, null, 2));
    
    console.log(`✅ Saved to: ${outputFile}`);
    return data;
  }
  
  console.log('❌ No alternative data source available');
  console.log('Please provide COLS stakers data in: ' + stakersFile);
  console.log('\nExpected format:');
  console.log('[{"address": "erd1...", "colsStake": 100.5}, ...]');
  
  return [];
}

main().catch(console.error);