import * as fs from "fs";

// Configuration
const COLS_TOKEN_ID = "COLS-9d91b7";
const EGLD_TOKEN_ID = "EGLD";
const APR_MIN = 0.005;  // 0.5%
const APR_MAX = 0.30;   // 30%
const MAX_COLS_PER_EGLD = 100;

// API endpoints
const PRICE_API = "https://api.multiversx.com/tokens";
const STAKING_API = "https://staking.colombia-staking.com/mvx-api/providers";

// Delegation contract
const DELEGATION_CONTRACT = "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf";

/**
 * Fetch current token price from APIs
 */
async function fetchColsPrice() {
  try {
    const response = await fetch(`${PRICE_API}/${COLS_TOKEN_ID}`);
    const data = await response.json();
    return parseFloat(data.price) || null;
  } catch (error) {
    console.error("Error fetching COLS price:", error.message);
    return null;
  }
}

async function fetchEgldPrice() {
  try {
    // Try CoinGecko first
    const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=elrond-erd-2&vs_currencies=usd");
    const data = await response.json();
    return data["elrond-erd-2"]?.usd || null;
  } catch (error) {
    console.error("Error fetching EGLD price:", error.message);
    return null;
  }
}

/**
 * Fetch EGLD delegators from staking API
 */
async function fetchEGLDDelegators() {
  try {
    const response = await fetch(`${STAKING_API}/${DELEGATION_CONTRACT}/accounts?size=1000`);
    const data = await response.json();
    
    const delegators = [];
    for (const d of data) {
      const stake = parseFloat(d.stake || 0) / 1e18;
      if (stake > 0) {
        delegators.push({
          address: d.address,
          egldStake: stake
        });
      }
    }
    return delegators;
  } catch (error) {
    console.error("Error fetching EGLD delegators:", error.message);
    return [];
  }
}

/**
 * Parse COLS stakers from encoded data (from smart contract query)
 */
function parseColsStakers() {
  // This would normally come from a smart contract query
  // For now, read from cached file
  try {
    const data = fs.readFileSync("/tmp/cols_stakers.json", "utf-8");
    return JSON.parse(data);
  } catch {
    console.log("COLS stakers file not found, using empty array");
    return [];
  }
}

/**
 * Calculate APR bonus based on COLS/EGLD ratio
 */
function calculateAprBonus(egldStake, colsStake) {
  const ratio = colsStake / (egldStake * MAX_COLS_PER_EGLD / 100);
  const normalized = Math.min(ratio, 1.0);
  return APR_MIN + (APR_MAX - APR_MIN) * Math.sqrt(normalized);
}

/**
 * Main distribution calculation
 */
async function main() {
  console.log("=" .repeat(70));
  console.log("📊 COLS DAILY DISTRIBUTION CALCULATOR");
  console.log("=" .repeat(70));
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log();

  // Fetch current prices
  console.log("Fetching prices...");
  const [colsPrice, egldPrice] = await Promise.all([
    fetchColsPrice(),
    fetchEgldPrice()
  ]);

  // Fallback prices if API fails
  const finalColsPrice = colsPrice || 0.147;
  const finalEgldPrice = egldPrice || 5.00;

  if (!colsPrice) console.log("⚠️  COLS price API failed, using fallback");
  if (!egldPrice) console.log("⚠️  EGLD price API failed, using fallback");

  console.log(`COLS Price: $${finalColsPrice.toFixed(6)}`);
  console.log(`EGLD Price: $${finalEgldPrice.toFixed(2)}`);
  console.log();

  // Fetch delegators
  console.log("Fetching EGLD delegators...");
  const delegators = await fetchEGLDDelegators();
  console.log(`Found ${delegators.length} EGLD delegators`);

  // Get COLS stakers
  const colsStakers = parseColsStakers();
  console.log(`Found ${colsStakers.length} COLS stakers`);

  // Create lookup
  const colsByAddress = {};
  for (const s of colsStakers) {
    colsByAddress[s.address] = s.colsStaked;
  }

  // Find eligible (both EGLD delegate + COLS stake)
  const eligible = [];
  for (const d of delegators) {
    const colsStake = colsByAddress[d.address] || 0;
    if (colsStake > 0 && d.egldStake > 0) {
      eligible.push({
        address: d.address,
        egldStake: d.egldStake,
        colsStake: colsStake
      });
    }
  }

  console.log(`Eligible for Bonus Pool: ${eligible.length}`);
  console.log();

  // Calculate distribution (pre-scaling)
  const distributions = [];
  let totalCalculated = 0;

  for (const e of eligible) {
    const aprBonus = calculateAprBonus(e.egldStake, e.colsStake);
    const dailyCols = (aprBonus * e.egldStake * finalEgldPrice) / 365 / finalColsPrice;
    
    distributions.push({
      address: e.address,
      egldStake: e.egldStake,
      colsStake: e.colsStake,
      aprBonus: aprBonus * 100,
      dailyCols: dailyCols
    });
    totalCalculated += dailyCols;
  }

  console.log(`Pre-scale total: ${totalCalculated.toFixed(4)} COLS`);

  // Get total daily COLS to distribute
  // This should come from the DAO/agency buyback pool
  // For now, use the expected values
  const TOTAL_DAILY_COLS = process.env.TOTAL_COLS ? parseFloat(process.env.TOTAL_COLS) : 43.99;
  const DAO_POOL_RATIO = 1/3;
  const BONUS_POOL_RATIO = 2/3;
  
  const targetBonusPool = TOTAL_DAILY_COLS * BONUS_POOL_RATIO; // ~29.33 COLS
  
  // Scale to target
  let scale = 1;
  if (totalCalculated > 0) {
    scale = targetBonusPool / totalCalculated;
  }
  console.log(`Target Bonus Pool: ${targetBonusPool.toFixed(2)} COLS`);
  console.log(`Scaling factor: ${scale.toFixed(6)}`);
  
  // Apply scaling
  for (const d of distributions) {
    d.dailyCols *= scale;
  }

  // Output
  console.log();
  console.log("-".repeat(70));
  console.log("📋 TOP 20 RECIPIENTS:");
  console.log("-".repeat(70));

  distributions.sort((a, b) => b.dailyCols - a.dailyCols);

  for (let i = 0; i < 20 && i < distributions.length; i++) {
    const d = distributions[i];
    console.log(`${(i+1).toString().padStart(3)}. ${d.address.substring(0, 40)}...`);
    console.log(`     EGLD: ${d.egldStake.toFixed(2).padStart(12)} | COLS: ${d.colsStake.toFixed(2).padStart(10)} | APR: ${d.aprBonus.toFixed(1)}% | Daily: ${d.dailyCols.toFixed(6)} COLS`);
  }

  // Apply scaling and recalculate total
  const totalDistributed = distributions.reduce((sum, d) => sum + d.dailyCols, 0);

  // Summary
  console.log();
  console.log("-".repeat(70));
  console.log("SUMMARY:");
  console.log("-".repeat(70));
  console.log(`Total eligible: ${eligible.length}`);
  console.log(`Total to distribute: ${totalDistributed.toFixed(6)} COLS`);
  console.log(`COLS price: $${finalColsPrice.toFixed(6)}`);
  console.log(`EGLD price: $${finalEgldPrice.toFixed(2)}`);
  console.log(`Min: ${Math.min(...distributions.map(d => d.dailyCols)).toFixed(6)} COLS`);
  console.log(`Max: ${Math.max(...distributions.map(d => d.dailyCols)).toFixed(6)} COLS`);

  // Save to file
  const outputPath = '/tmp/distribution_list.txt';
  fs.writeFileSync(outputPath, distributions.map(d => `${d.address};${d.dailyCols.toFixed(6)}`).join('\n'));
  console.log(`\n✅ Saved ${distributions.length} recipients to ${outputPath}`);

  return {
    date: new Date().toISOString().split('T')[0],
    colsPrice: finalColsPrice,
    egldPrice: finalEgldPrice,
    bonusPool: totalDistributed,
    recipients: distributions.length,
    distributions
  };
}

main().catch(console.error);