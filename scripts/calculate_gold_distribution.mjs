/**
 * Calculate Gold Member Daily Distribution
 * 
 * Gold members get back their daily service fee as COLS tokens
 * 
 * Formula:
 *   dailyServiceFeeEgld = min(eGLD, goldCapacity) × rawApr × serviceFee / 365
 *   dailyServiceFeeCols = dailyServiceFeeEgld × (egldPrice / colsPrice)
 * 
 * Gold NFT Collection: COL-70965c
 * Each NFT = 500 eGLD capacity at 0% fee
 */

import * as fs from "fs";

// Configuration
const COLS_TOKEN_ID = "COLS-9d91b7";
const GOLD_COLLECTION = "COL-70965c";
const GOLD_EGLD_CAPACITY_PER_NFT = 500;
const SERVICE_FEE = 0.10; // 10%
const DAYS_IN_YEAR = 365;

// API endpoints - Use Kepler (Colombian Staking API)
const PRICE_API = "https://api.multiversx.com/tokens";
const STAKING_API = "https://staking.colombia-staking.com/mvx-api/providers";
const MX_API = "https://staking.colombia-staking.com/mvx-api";

// Delegation contract
const DELEGATION_CONTRACT = "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf";

/**
 * Fetch current token prices from MultiversX API
 */
async function fetchPrices() {
  try {
    const [colsRes, egldRes] = await Promise.all([
      fetch(`${PRICE_API}/${COLS_TOKEN_ID}`),
      fetch(`${PRICE_API}/EGLD`)
    ]);
    
    const colsData = await colsRes.json();
    const egldData = await egldRes.json();
    
    return {
      colsPrice: parseFloat(colsData.price) || null,
      egldPrice: parseFloat(egldData.price) || null
    };
  } catch (error) {
    console.error("Error fetching prices:", error.message);
    return { colsPrice: null, egldPrice: null };
  }
}

/**
 * Fetch all Gold NFT holders using Kepler API with batching
 */
async function fetchGoldMembers() {
  try {
    // First get all delegators with their stake
    const delegatorsResponse = await fetch(
      `${STAKING_API}/${DELEGATION_CONTRACT}/accounts?size=1000`
    );
    const delegatorsData = await delegatorsResponse.json();
    
    const delegators = delegatorsData.map(d => d.address);
    console.log(`📊 Found ${delegators.length} delegators, checking for Gold NFTs via Kepler API...`);
    
    // Process in parallel batches
    const goldMembers = [];
    const batchSize = 20;
    
    for (let i = 0; i < delegators.length; i += batchSize) {
      const batch = delegators.slice(i, i + batchSize);
      
      const results = await Promise.all(
        batch.map(async (address) => {
          try {
            const response = await fetch(
              `${MX_API}/accounts/${address}/nfts?collection=${GOLD_COLLECTION}&size=10`
            );
            
            if (response.ok) {
              const nfts = await response.json();
              if (Array.isArray(nfts) && nfts.length > 0) {
                return { address, nftCount: nfts.length };
              }
            }
          } catch (e) {
            // Skip errors
          }
          return null;
        })
      );
      
      // Collect found Gold members
      for (const result of results) {
        if (result) {
          goldMembers.push({
            address: result.address,
            nftCount: result.nftCount,
            goldCapacity: result.nftCount * GOLD_EGLD_CAPACITY_PER_NFT
          });
          console.log(`   ✅ ${result.address.slice(0, 8)}... (${result.nftCount} NFTs)`);
        }
      }
      
      console.log(`   Progress: ${Math.min(i + batchSize, delegators.length)}/${delegators.length}`);
    }
    
    console.log(`📊 Found ${goldMembers.length} Gold members with delegations`);
    return goldMembers;
  } catch (error) {
    console.error("Error fetching Gold members:", error.message);
    return [];
  }
}

/**
 * Fetch current APR from staking API
 */
async function fetchApr() {
  try {
    const response = await fetch(`${STAKING_API}/${DELEGATION_CONTRACT}`);
    const data = await response.json();
    // APR from API is already with fee deducted (e.g., 8.41%)
    const aprWithFee = parseFloat(data.apr) || 0;
    // Calculate raw APR before fee
    const rawApr = aprWithFee / (1 - SERVICE_FEE);
    return { aprWithFee, rawApr };
  } catch (error) {
    console.error("Error fetching APR:", error.message);
    return { aprWithFee: 8.41, rawApr: 9.35 }; // Fallback
  }
}

/**
 * Fetch EGLD delegation for addresses
 */
async function fetchDelegations(addresses) {
  try {
    const response = await fetch(
      `${STAKING_API}/${DELEGATION_CONTRACT}/accounts?size=1000`
    );
    const data = await response.json();
    
    // Create lookup map - stake is in raw format (wei)
    const delegations = {};
    for (const account of data) {
      // Convert from wei to eGLD
      delegations[account.address] = parseFloat(account.stake) / 1e18;
    }
    
    return delegations;
  } catch (error) {
    console.error("Error fetching delegations:", error.message);
    return {};
  }
}

/**
 * Main calculation
 */
async function main() {
  console.log("═".repeat(70));
  console.log("💰 GOLD MEMBER DAILY DISTRIBUTION CALCULATOR");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");
  
  // Fetch data
  console.log("📡 Fetching data...");
  const [prices, apr, goldMembers] = await Promise.all([
    fetchPrices(),
    fetchApr(),
    fetchGoldMembers()
  ]);
  
  const { colsPrice, egldPrice } = prices;
  const { aprWithFee, rawApr } = apr;
  
  // Fallback prices if API fails
  const finalColsPrice = colsPrice || 0.147;
  const finalEgldPrice = egldPrice || 5.00;
  
  if (!colsPrice) console.log("⚠️  COLS price API failed, using fallback:", finalColsPrice);
  if (!egldPrice) console.log("⚠️  EGLD price API failed, using fallback:", finalEgldPrice);
  
  console.log("");
  console.log("📊 Current Data:");
  console.log(`   APR (with fee): ${aprWithFee.toFixed(2)}%`);
  console.log(`   APR (raw): ${rawApr.toFixed(2)}%`);
  console.log(`   COLS Price: $${finalColsPrice.toFixed(4)}`);
  console.log(`   EGLD Price: $${finalEgldPrice.toFixed(2)}`);
  console.log("");
  
  // Get delegations for all addresses
  const addresses = goldMembers.map(g => g.address);
  const delegations = await fetchDelegations(addresses);
  
  // Calculate distribution for each Gold member
  const recipients = [];
  let totalCols = 0;
  
  console.log("📊 Gold Member Daily Distribution:");
  console.log("─".repeat(70));
  
  for (const member of goldMembers) {
    const { address, nftCount, goldCapacity } = member;
    
    // Get user's eGLD delegation
    const delegatedEgld = delegations[address] || 0;
    
    // Calculate gold-eligible eGLD (up to capacity)
    const goldEligibleEgld = Math.min(delegatedEgld, goldCapacity);
    
    if (goldEligibleEgld <= 0) {
      console.log(`   ${address.slice(0, 8)}...${address.slice(-4)}: No delegation - skipped`);
      continue;
    }
    
    // Calculate daily service fee rebate in eGLD
    // Formula: eGLD × rawApr × serviceFee / 365
    const dailyServiceFeeEgld = goldEligibleEgld * rawApr * SERVICE_FEE / DAYS_IN_YEAR;
    
    // Convert to COLS
    const dailyServiceFeeCols = dailyServiceFeeEgld * (finalEgldPrice / finalColsPrice);
    
    // Only include if worth sending (minimum 0.01 COLS)
    if (dailyServiceFeeCols >= 0.01) {
      recipients.push({
        address,
        nftCount,
        goldCapacity,
        delegatedEgld: delegatedEgld.toFixed(2),
        goldEligibleEgld: goldEligibleEgld.toFixed(2),
        dailyServiceFeeEgld: dailyServiceFeeEgld.toFixed(6),
        dailyServiceFeeCols: dailyServiceFeeCols.toFixed(6)
      });
      
      totalCols += dailyServiceFeeCols;
      
      console.log(`   ${address.slice(0, 8)}...${address.slice(-4)}: ${goldEligibleEgld.toFixed(0)} eGLD → ${dailyServiceFeeCols.toFixed(4)} COLS`);
    }
  }
  
  console.log("");
  console.log("📊 Summary:");
  console.log(`   Total recipients: ${recipients.length}`);
  console.log(`   Total COLS: ${totalCols.toFixed(4)}`);
  console.log("");
  
  // Save distribution file
  const distribution = {
    timestamp: new Date().toISOString(),
    aprWithFee,
    rawApr,
    colsPrice: finalColsPrice,
    egldPrice: finalEgldPrice,
    recipients: recipients.map(r => ({
      address: r.address,
      amount: parseFloat(r.dailyServiceFeeCols)
    })),
    totalCols,
    stats: {
      recipients: recipients.length,
      totalCols,
      totalEgld: recipients.reduce((sum, r) => sum + parseFloat(r.dailyServiceFeeEgld), 0)
    }
  };
  
  const filename = `/tmp/cols_distribution/gold_distribution_${new Date().toISOString().slice(0, 10)}.json`;
  fs.mkdirSync("/tmp/cols_distribution", { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(distribution, null, 2));
  
  console.log(`✅ Distribution saved to: ${filename}`);
  console.log("");
  
  // Print for copy-paste
  console.log("💰 GOLD DISTRIBUTION DATA:");
  console.log(JSON.stringify(distribution, null, 2));
}

main().catch(console.error);
