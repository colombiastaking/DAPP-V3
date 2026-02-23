#!/usr/bin/env node
/**
 * Calculate Gold Member Daily Distribution - EFFICIENT VERSION
 * 
 * Strategy:
 * 1. Fetch all Gold NFTs from collection (50 NFTs) - single API call
 * 2. Extract unique owner addresses
 * 3. Look up delegations for those addresses
 * 4. Calculate distribution
 * 5. Cache everything for fallback
 */

import * as fs from 'fs';
import fetch from 'node-fetch';

const CONFIG = {
  COLS_TOKEN_ID: "COLS-9d91b7",
  GOLD_COLLECTION: "COL-70965c",
  GOLD_EGLD_CAPACITY_PER_NFT: 500,
  SERVICE_FEE: 0.10,
  DAYS_IN_YEAR: 365,
  DELEGATION_CONTRACT: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf",
  OUTPUT_DIR: "/tmp/cols_distribution"
};

// API endpoints
const APIs = {
  multiversx: "https://api.multiversx.com",
  local: "http://192.168.0.120"
};

/**
 * Safe fetch with timeout
 */
async function fetchWithTimeout(url, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Load cached data
 */
function loadCache(name) {
  try {
    const path = `${CONFIG.OUTPUT_DIR}/${name}`;
    if (fs.existsSync(path)) {
      return JSON.parse(fs.readFileSync(path, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

/**
 * Save to cache
 */
function saveCache(name, data) {
  try {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(`${CONFIG.OUTPUT_DIR}/${name}`, JSON.stringify(data, null, 2));
  } catch (e) {}
}

/**
 * Load last distribution
 */
function loadLastDistribution() {
  try {
    const files = fs.readdirSync(CONFIG.OUTPUT_DIR)
      .filter(f => f.startsWith('gold_distribution_') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    for (const file of files) {
      const data = JSON.parse(fs.readFileSync(`${CONFIG.OUTPUT_DIR}/${file}`, 'utf-8'));
      if (data.recipients?.length > 0) {
        return data;
      }
    }
  } catch (e) {}
  return null;
}

/**
 * Fetch all Gold NFT owners from collection
 */
async function fetchGoldNftOwners() {
  console.log("📡 Fetching Gold NFT owners from collection...");
  
  try {
    // First get all NFT IDs in the collection
    const nfts = await fetchWithTimeout(
      `${APIs.multiversx}/collections/${CONFIG.GOLD_COLLECTION}/nfts?size=50`
    );
    
    if (!Array.isArray(nfts) || nfts.length === 0) {
      throw new Error("No NFTs returned");
    }
    
    // Get owner for each NFT (individual queries)
    console.log(`  📊 Found ${nfts.length} NFTs, fetching owners...`);
    
    const ownerMap = {};
    const batchSize = 5;
    
    for (let i = 0; i < nfts.length; i += batchSize) {
      const batch = nfts.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (nft) => {
        try {
          const detail = await fetchWithTimeout(
            `${APIs.multiversx}/nfts/${nft.identifier}`
          );
          
          if (detail.owner) {
            if (!ownerMap[detail.owner]) {
              ownerMap[detail.owner] = { count: 0 };
            }
            ownerMap[detail.owner].count++;
          }
        } catch (e) {
          // Skip failed
        }
      }));
      
      console.log(`    Progress: ${Math.min(i + batchSize, nfts.length)}/${nfts.length}`);
    }
    
    const owners = Object.keys(ownerMap).map(addr => ({
      address: addr,
      nftCount: ownerMap[addr].count,
      goldCapacity: ownerMap[addr].count * CONFIG.GOLD_EGLD_CAPACITY_PER_NFT
    }));
    
    console.log(`  ✅ Found ${owners.length} unique Gold NFT owners`);
    
    // Cache it
    saveCache('gold_nft_owners.json', {
      timestamp: new Date().toISOString(),
      owners: owners
    });
    
    return owners;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    
    // Try cache
    const cached = loadCache('gold_nft_owners.json');
    if (cached?.owners?.length > 0) {
      console.log(`  📦 Using cached: ${cached.owners.length} owners`);
      return cached.owners;
    }
    
    return [];
  }
}

/**
 * Fetch prices
 */
async function fetchPrices() {
  console.log("📡 Fetching prices...");
  
  try {
    const [colsRes, egldRes] = await Promise.all([
      fetchWithTimeout(`${APIs.multiversx}/tokens/${CONFIG.COLS_TOKEN_ID}`),
      fetchWithTimeout(`${APIs.multiversx}/economics`)
    ]);
    
    const colsPrice = parseFloat(colsRes.price) || 0.15;
    const egldPrice = parseFloat(egldRes.price) || 4.66;
    
    console.log(`  ✅ COLS: $${colsPrice}, EGLD: $${egldPrice}`);
    
    saveCache('gold_prices.json', { colsPrice, egldPrice, timestamp: new Date().toISOString() });
    
    return { colsPrice, egldPrice };
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    const cached = loadCache('gold_prices.json');
    if (cached?.colsPrice) {
      console.log(`  📦 Using cached: COLS $${cached.colsPrice}, EGLD $${cached.egldPrice}`);
      return { colsPrice: cached.colsPrice, egldPrice: cached.egldPrice };
    }
    return { colsPrice: 0.15, egldPrice: 4.66 };
  }
}

/**
 * Fetch APR
 */
async function fetchApr() {
  console.log("📡 Fetching APR...");
  
  try {
    const data = await fetchWithTimeout(
      `${APIs.multiversx}/providers/${CONFIG.DELEGATION_CONTRACT}`
    );
    
    const provider = Array.isArray(data) ? data[0] : data;
    const aprWithFee = parseFloat(provider.apr) || 8.41;
    const rawApr = aprWithFee / (1 - CONFIG.SERVICE_FEE);
    
    console.log(`  ✅ APR: ${aprWithFee}% (with fee), ${rawApr}% (raw)`);
    
    saveCache('gold_apr.json', { aprWithFee, rawApr, timestamp: new Date().toISOString() });
    
    return { aprWithFee, rawApr };
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    const cached = loadCache('gold_apr.json');
    if (cached?.rawApr) {
      console.log(`  📦 Using cached: ${cached.aprWithFee}% / ${cached.rawApr}%`);
      return { aprWithFee: cached.aprWithFee, rawApr: cached.rawApr };
    }
    return { aprWithFee: 8.41, rawApr: 9.35 };
  }
}

/**
 * Fetch delegations for specific addresses
 */
async function fetchDelegations(addresses) {
  console.log(`📡 Fetching delegations for ${addresses.length} addresses...`);
  
  const delegations = {};
  
  // Fetch delegators in batches from provider
  try {
    const allDelegators = [];
    let offset = 0;
    const batchSize = 100;
    
    while (true) {
      const data = await fetchWithTimeout(
        `${APIs.multiversx}/providers/${CONFIG.DELEGATION_CONTRACT}/accounts?size=${batchSize}&from=${offset}`
      );
      
      if (!Array.isArray(data) || data.length === 0) break;
      
      allDelegators.push(...data);
      
      if (data.length < batchSize) break;
      offset += batchSize;
    }
    
    console.log(`  ✅ Total delegators: ${allDelegators.length}`);
    
    // Create lookup map
    const delegatorMap = {};
    for (const d of allDelegators) {
      delegatorMap[d.address] = parseFloat(d.stake) / 1e18;
    }
    
    // Filter to only Gold NFT owners
    for (const addr of addresses) {
      delegations[addr] = delegatorMap[addr] || 0;
    }
    
    return delegations;
  } catch (e) {
    console.log(`  ❌ Failed: ${e.message}`);
    
    // Try local API
    try {
      let offset = 0;
      const batchSize = 100;
      
      while (true) {
        const data = await fetchWithTimeout(
          `${APIs.local}/providers/${CONFIG.DELEGATION_CONTRACT}/accounts?size=${batchSize}&from=${offset}`
        );
        
        if (!Array.isArray(data) || data.length === 0) break;
        
        for (const d of data) {
          if (addresses.includes(d.address)) {
            delegations[d.address] = parseFloat(d.stake) / 1e18;
          }
        }
        
        if (data.length < batchSize) break;
        offset += batchSize;
      }
      
      console.log(`  ✅ From local: ${Object.keys(delegations).length} found`);
      return delegations;
    } catch (e2) {
      console.log(`  ❌ Local also failed: ${e2.message}`);
    }
    
    // Use last distribution data
    const lastDist = loadLastDistribution();
    if (lastDist?.recipients?.length > 0) {
      console.log(`  📦 Using last distribution data`);
      for (const r of lastDist.recipients) {
        delegations[r.address] = parseFloat(r.delegatedEgld) || 0;
      }
    }
    
    return delegations;
  }
}

/**
 * Main
 */
async function main() {
  console.log("═".repeat(70));
  console.log("💰 GOLD MEMBER DAILY DISTRIBUTION (EFFICIENT)");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");
  
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  
  // Step 1: Get Gold NFT owners
  const goldOwners = await fetchGoldNftOwners();
  
  if (goldOwners.length === 0) {
    console.log("❌ No Gold NFT owners found, using last distribution");
    const lastDist = loadLastDistribution();
    if (lastDist) {
      console.log(JSON.stringify(lastDist, null, 2));
    }
    return;
  }
  
  // Step 2: Get prices
  const { colsPrice, egldPrice } = await fetchPrices();
  
  // Step 3: Get APR
  const { aprWithFee, rawApr } = await fetchApr();
  
  // Step 4: Get delegations for Gold owners
  const addresses = goldOwners.map(o => o.address);
  const delegations = await fetchDelegations(addresses);
  
  // Step 5: Calculate distribution
  console.log("");
  console.log("📊 Calculating distribution...");
  
  const recipients = [];
  let totalCols = 0;
  
  for (const owner of goldOwners) {
    const delegatedEgld = delegations[owner.address] || 0;
    const goldEligibleEgld = Math.min(delegatedEgld, owner.goldCapacity);
    
    if (goldEligibleEgld <= 0) continue;
    
    // Calculate: eGLD × rawApr × serviceFee / 365 × (egldPrice / colsPrice)
    const dailyServiceFeeEgld = goldEligibleEgld * (rawApr / 100) * CONFIG.SERVICE_FEE / CONFIG.DAYS_IN_YEAR;
    const dailyServiceFeeCols = dailyServiceFeeEgld * (egldPrice / colsPrice);
    
    if (dailyServiceFeeCols >= 0.01) {
      recipients.push({
        address: owner.address,
        nftCount: owner.nftCount,
        goldCapacity: owner.goldCapacity,
        delegatedEgld: delegatedEgld.toFixed(2),
        goldEligibleEgld: goldEligibleEgld.toFixed(2),
        dailyServiceFeeCols: dailyServiceFeeCols.toFixed(6)
      });
      
      totalCols += dailyServiceFeeCols;
    }
  }
  
  // Sort by amount descending
  recipients.sort((a, b) => parseFloat(b.dailyServiceFeeCols) - parseFloat(a.dailyServiceFeeCols));
  
  console.log("");
  console.log("📊 Recipients:");
  for (const r of recipients) {
    console.log(`   ${r.address.slice(0, 16)}... → ${r.dailyServiceFeeCols} COLS`);
  }
  
  console.log("");
  console.log("📊 Summary:");
  console.log(`   Recipients: ${recipients.length}`);
  console.log(`   Total COLS: ${totalCols.toFixed(4)}`);
  
  // Save distribution
  const distribution = {
    timestamp: new Date().toISOString(),
    aprWithFee,
    rawApr,
    colsPrice,
    egldPrice,
    recipients: recipients.map(r => ({
      address: r.address,
      amount: parseFloat(r.dailyServiceFeeCols),
      nftCount: r.nftCount,
      goldCapacity: r.goldCapacity,
      delegatedEgld: r.delegatedEgld
    })),
    totalCols,
    stats: {
      recipients: recipients.length,
      totalCols,
      totalEgld: recipients.reduce((sum, r) => sum + parseFloat(r.delegatedEgld), 0)
    }
  };
  
  const filename = `${CONFIG.OUTPUT_DIR}/gold_distribution_${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(filename, JSON.stringify(distribution, null, 2));
  console.log(`✅ Saved to: ${filename}`);
  
  // Also save as latest
  fs.writeFileSync(`${CONFIG.OUTPUT_DIR}/gold_distribution_latest.json`, JSON.stringify(distribution, null, 2));
  
  console.log("");
  console.log("💰 DISTRIBUTION DATA:");
  console.log(JSON.stringify(distribution, null, 2));
}

main().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
