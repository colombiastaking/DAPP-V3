/**
 * COLS Distribution Scripts - CommonJS version for SDK v15
 * 
 * TWO POOLS:
 * 
 * 1. DAO POOL (1/3 of buyback):
 *    - ONE transaction to PeerMe smart contract
 *    - Call distribute() function with entity argument
 *    - Contract distributes proportionally to ALL COLS stakers
 *    
 * 2. BONUS POOL (2/3 of buyback):
 *    - Individual ESDT transfers to each eligible address
 *    - Eligible = has BOTH EGLD delegated AND COLS staked
 * 
 * Usage:
 *   node execute_distribution.mjs --dao          # Execute DAO distribution only
 *   node execute_distribution.mjs --bonus        # Execute BONUS distribution only  
 *   node execute_distribution.mjs --all          # Execute both
 */

const fs = require("fs");
const sdk = require("@multiversx/sdk-core");
const { ProxyNetworkProvider } = require("@multiversx/sdk-network-providers");
const { UserSecretKey } = require("@multiversx/sdk-wallet");

const { Address, TransferTransactionsFactory, TransactionsFactoryConfig, TokenTransfer, Transaction, TransactionComputer } = sdk;

// Configuration
const NETWORK_PROVIDER = "https://gateway.multiversx.com";
const CHAIN_ID = "1";

// State file to track what's been sent
const STATE_FILE = "/tmp/cols_distribution/state.json";

// Load state
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { lastDistributionDate: null, lastDaoHash: null, lastBonusCount: 0, nonce: null };
}

// Save state
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Check if already distributed today
function checkAlreadyDistributed(state, doDao, doBonus) {
  const today = new Date().toISOString().slice(0, 10);
  
  if (state.lastDistributionDate === today) {
    console.log(`⚠️  Distribution already executed today: ${today}`);
    if (doDao && state.lastDaoHash) {
      console.log(`   DAO: ${state.lastDaoHash}`);
    }
    if (doBonus && state.lastBonusCount > 0) {
      console.log(`   BONUS: ${state.lastBonusCount} txs`);
    }
    console.log(`   To re-run, delete state file: rm ${STATE_FILE}`);
    return true;
  }
  return false;
}

// Configuration

// Contracts
const COLS_TOKEN_ID = "COLS-9d91b7";
const PEERME_CLAIM_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";
const COLOMBIA_ENTITY = "erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0";

// Gas limits
const GAS_ESDT_TRANSFER = 600000;
const GAS_DAO_DISTRIBUTE = 10000000; // 10M for contract call

// Load wallet
function loadWallet() {
  const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
  return UserSecretKey.fromString(keyHex);
}

// Load distribution data
function loadDistribution() {
  const files = fs.readdirSync('/tmp/cols_distribution')
    .filter(f => f.startsWith('bonus_distribution_'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    throw new Error('No distribution file found. Run: ./run_distribution.sh calc');
  }
  
  return JSON.parse(fs.readFileSync(`/tmp/cols_distribution/${files[0]}`, 'utf-8'));
}

// Helper: Convert COLS amount to hex (with proper padding)
function colsToHex(amount) {
  let hex = BigInt(Math.floor(amount * 1e18)).toString(16);
  // Ensure even length for valid bytecode
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

// Helper: Convert string to hex
function stringToHex(str) {
  return Buffer.from(str).toString('hex');
}

/**
 * Build DAO distribution transaction using manual transaction construction
 * 
 * Format: ESDTTransfer@TOKEN_HEX@AMOUNT_HEX@FUNCTION_HEX@ENTITY_HEX
 * This calls the distribute() function on the PeerMe claim contract
 * which distributes tokens proportionally to all COLS stakers
 */
function buildDaoTransaction(sender, amount) {
  // Convert amounts
  const amountHex = colsToHex(amount);
  const functionHex = stringToHex("distribute");
  const entityHex = new Address(COLOMBIA_ENTITY).getPublicKey().toString('hex');
  
  // Build data field for contract call with arguments
  const data = `ESDTTransfer@${stringToHex(COLS_TOKEN_ID)}@${amountHex}@${functionHex}@${entityHex}`;
  
  console.log(`   Token hex: ${stringToHex(COLS_TOKEN_ID)}`);
  console.log(`   Amount hex: ${amountHex}`);
  console.log(`   Function hex: ${functionHex} ("distribute")`);
  console.log(`   Entity hex: ${entityHex}`);
  console.log(`   Full data: ${data}`);
  
  return new Transaction({
    sender: sender,
    receiver: new Address(PEERME_CLAIM_CONTRACT),
    value: 0n,
    gasLimit: GAS_DAO_DISTRIBUTE,
    chainID: CHAIN_ID,
    data: Buffer.from(data)
  });
}

/**
 * Build BONUS transfer transaction manually
 */
function buildBonusTransaction(sender, recipient, amount) {
  const amountHex = colsToHex(amount);
  const data = `ESDTTransfer@${stringToHex(COLS_TOKEN_ID)}@${amountHex}`;
  
  return new Transaction({
    sender: sender,
    receiver: new Address(recipient),
    value: 0n,
    gasLimit: GAS_ESDT_TRANSFER,
    chainID: CHAIN_ID,
    data: Buffer.from(data)
  });
}

/**
 * Sign and send transaction - Using SDK's TransactionComputer
 */
async function signAndSend(provider, tx, secretKey) {
  const transactionComputer = new TransactionComputer();
  
  // Serialize for signing using SDK
  const serializedTx = transactionComputer.computeBytesForSigning(tx);
  
  // Sign
  const signature = secretKey.sign(serializedTx);
  
  // Apply signature
  tx.signature = signature;
  
  // Send
  return await provider.sendTransaction(tx);
}

async function main() {
  const args = process.argv.slice(2);
  const doDao = args.includes('--dao') || args.includes('--all');
  const doBonus = args.includes('--bonus') || args.includes('--all');
  const doGold = args.includes('--gold') || args.includes('--all-gold');
  const force = args.includes('--force'); // Force re-run even if already done today
  
  if (!doDao && !doBonus && !doGold) {
    console.log("Usage:");
    console.log("  node execute_distribution.cjs --dao      # DAO pool only");
    console.log("  node execute_distribution.cjs --bonus  # BONUS pool only");
    console.log("  node execute_distribution.cjs --gold   # GOLD pool only");
    console.log("  node execute_distribution.cjs --all    # DAO + BONUS pools");
    console.log("  node execute_distribution.cjs --all --all-gold  # DAO + BONUS + GOLD");
    console.log("  node execute_distribution.cjs --all --force     # Force re-run");
    console.log("");
    console.log("IMPORTANT:");
    console.log("  DAO pool: Sends to PeerMe contract with distribute() call");
    console.log("  BONUS pool: Individual transfers to eligible addresses");
    console.log("  GOLD pool: Service fee rebate for Gold NFT holders");
    process.exit(1);
  }
  
  // Load state and check if already distributed
  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);
  
  if (!force && checkAlreadyDistributed(state, doDao, doBonus)) {
    console.log("Use --force to re-run anyway");
    process.exit(0);
  }
  
  console.log("═".repeat(70));
  console.log("🚀 COLS DISTRIBUTION EXECUTOR (SDK v15)");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");
  
  // Setup
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER, { timeout: 30000 });
  const secretKey = loadWallet();
  const senderPublicKey = secretKey.generatePublicKey();
  
  // SDK v15 quirk: toAddress() works with Provider but lacks toBech32()
  // new Address() has toBech32() but doesn't work with Provider
  const senderAddressForProvider = senderPublicKey.toAddress();
  const senderAddress = new Address(senderPublicKey.valueOf());
  const senderBech32 = senderAddress.toBech32();
  
  console.log(`Wallet: ${senderBech32}`);
  
  // Check balance
  const account = await provider.getAccount(senderAddressForProvider);
  console.log(`Nonce: ${account.nonce}`);
  console.log(`Balance: ${Number(account.balance) / 1e18} EGLD`);
  
  try {
    const tokens = await provider.getFungibleTokensOfAccount(senderAddressForProvider, [COLS_TOKEN_ID]);
    console.log(`COLS Balance: ${Number(tokens[0]?.balance || 0n) / 1e18}`);
  } catch (e) {
    console.log(`COLS Balance: (unable to fetch)`);
  }
  console.log("");
  
  // Load distribution
  const dist = loadDistribution();
  const bonusRecipients = dist.bonus.recipients;
  const totalBonus = dist.bonus.totalBonus;
  
  // Calculate DAO amount
  const totalBuyback = totalBonus / 0.667;
  const daoAmount = totalBuyback * 0.333;
  
  console.log("📊 Distribution Summary:");
  console.log(`   DAO Pool: ${daoAmount.toFixed(6)} COLS → PeerMe contract (distribute)`);
  console.log(`   BONUS Pool: ${totalBonus.toFixed(6)} COLS → ${bonusRecipients.length} addresses`);
  console.log(`   Total: ${(daoAmount + totalBonus).toFixed(6)} COLS`);
  console.log("");
  
  let nonce = Number(account.nonce);
  const results = { dao: null, bonus: [], gold: [] };
  
  // =============================================
  // DAO DISTRIBUTION (single transaction)
  // =============================================
  if (doDao) {
    console.log("═".repeat(70));
    console.log("🔴 DAO POOL: Distributing to PeerMe contract");
    console.log("═".repeat(70));
    console.log("");
    console.log(`Amount: ${daoAmount.toFixed(6)} COLS`);
    console.log(`Contract: ${PEERME_CLAIM_CONTRACT}`);
    console.log(`Entity: ${COLOMBIA_ENTITY}`);
    console.log(`Function: distribute()`);
    console.log("");
    
    const daoTx = buildDaoTransaction(senderAddress, daoAmount);
    daoTx.nonce = BigInt(nonce);
    
    try {
      const hash = await signAndSend(provider, daoTx, secretKey);
      results.dao = { hash, amount: daoAmount };
      console.log(`✅ DAO Transaction: ${hash}`);
      console.log(`   Explorer: https://explorer.multiversx.com/transactions/${hash}`);
      nonce++;
    } catch (e) {
      console.error(`❌ DAO Transaction failed: ${e.message}`);
      throw e;
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  // =============================================
  // BONUS DISTRIBUTION (individual transfers)
  // =============================================
  if (doBonus) {
    console.log("");
    console.log("═".repeat(70));
    console.log("🟢 BONUS POOL: Individual transfers");
    console.log("═".repeat(70));
    console.log(`Recipients: ${bonusRecipients.length}`);
    console.log("");
    
    let success = 0, fail = 0;
    
    for (const recipient of bonusRecipients) {
      const tx = buildBonusTransaction(senderAddress, recipient.address, recipient.amount);
      tx.nonce = BigInt(nonce);
      
      try {
        const hash = await signAndSend(provider, tx, secretKey);
        results.bonus.push({ hash, ...recipient });
        success++;
        
        if (success <= 5 || success % 20 === 0 || success === bonusRecipients.length) {
          console.log(`  ✅ [${success}/${bonusRecipients.length}] ${recipient.address.slice(0,12)}... → ${recipient.amount.toFixed(6)} COLS`);
        }
      } catch (e) {
        console.error(`  ❌ ${recipient.address.slice(0,12)}... → ${e.message}`);
        fail++;
      }
      
      nonce++;
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log("");
    console.log(`BONUS Complete: ${success} success, ${fail} failed`);
  }
  
  // Summary
  console.log("");
  console.log("═".repeat(70));
  console.log("🎉 DISTRIBUTION COMPLETE");
  console.log("═".repeat(70));
  
  if (results.dao) {
    console.log(`DAO: ${daoAmount.toFixed(6)} COLS → PeerMe contract`);
    console.log(`     https://explorer.multiversx.com/transactions/${results.dao.hash}`);
  }
  
  if (results.bonus.length > 0) {
    const totalSent = results.bonus.reduce((s, r) => s + r.amount, 0);
    console.log(`BONUS: ${totalSent.toFixed(6)} COLS → ${results.bonus.length} addresses`);
  }
  
  // =============================================
  // GOLD DISTRIBUTION (service fee rebate)
  // =============================================
  if (doGold) {
    console.log("");
    console.log("═".repeat(70));
    console.log("🟡 GOLD POOL: Service fee rebate for Gold NFT holders");
    console.log("═".repeat(70));
    
    // Load GOLD distribution
    const goldFile = `/tmp/cols_distribution/gold_distribution_latest.json`;
    let goldRecipients = [];
    
    if (fs.existsSync(goldFile)) {
      const goldData = JSON.parse(fs.readFileSync(goldFile, 'utf-8'));
      goldRecipients = goldData.recipients || [];
    }
    
    if (goldRecipients.length === 0) {
      console.log("⚠️ No GOLD recipients found. Run calculate_gold_distribution.mjs first.");
    } else {
      console.log(`Recipients: ${goldRecipients.length}`);
      console.log("");
      
      let success = 0, fail = 0;
      
      for (const recipient of goldRecipients) {
        const tx = buildBonusTransaction(senderAddress, recipient.address, recipient.amount);
        tx.nonce = BigInt(nonce);
        
        try {
          const hash = await signAndSend(provider, tx, secretKey);
          results.gold = results.gold || [];
          results.gold.push({ hash, address: recipient.address, amount: recipient.amount });
          success++;
          
          if (success <= 5 || success % 10 === 0 || success === goldRecipients.length) {
            console.log(`  ✅ [${success}/${goldRecipients.length}] ${recipient.address.slice(0,12)}... → ${recipient.amount.toFixed(6)} COLS`);
          }
        } catch (e) {
          console.error(`  ❌ ${recipient.address.slice(0,12)}... → ${e.message}`);
          fail++;
        }
        
        nonce++;
        await new Promise(r => setTimeout(r, 100));
      }
      
      console.log("");
      console.log(`GOLD Complete: ${success} success, ${fail} failed`);
      
      if (results.gold?.length > 0) {
        const totalGold = results.gold.reduce((s, r) => s + r.amount, 0);
        console.log(`GOLD: ${totalGold.toFixed(6)} COLS → ${results.gold.length} addresses`);
      }
    }
  }
  
  // Save state to prevent duplicate runs
  const finalState = {
    lastDistributionDate: today,
    lastDaoHash: results.dao?.hash || state.lastDaoHash,
    lastBonusCount: results.bonus.length || state.lastBonusCount,
    lastGoldCount: results.gold?.length || 0,
    lastNonce: nonce,
    lastDistribution: {
      dao: results.dao?.hash ? { amount: daoAmount, tx: results.dao.hash } : null,
      bonus: results.bonus.length > 0 ? { count: results.bonus.length, total: results.bonus.reduce((s, r) => s + r.amount, 0) } : null,
      gold: results.gold?.length > 0 ? { count: results.gold.length, total: results.gold.reduce((s, r) => s + r.amount, 0) } : null
    }
  };
  saveState(finalState);
  console.log(`\nState saved to prevent duplicate runs`);
  
  // Save results
  const resultFile = `/tmp/cols_distribution/results_${new Date().toISOString().slice(0,10)}.json`;
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    dao: results.dao,
    bonus: results.bonus.slice(0, 10),
    bonusCount: results.bonus.length,
    gold: results.gold?.slice(0, 10) || [],
    goldCount: results.gold?.length || 0,
    totalColsDistributed: (results.dao?.amount || 0) + results.bonus.reduce((s, r) => s + r.amount, 0) + (results.gold?.reduce((s, r) => s + r.amount, 0) || 0)
  }, null, 2));
  console.log(`\nResults saved: ${resultFile}`);
}

main().catch(console.error);
