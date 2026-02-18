/**
 * Execute Gold Member Daily Distribution
 * 
 * Sends COLS tokens to Gold members as daily service fee rebate
 * 
 * Usage:
 *   node execute_gold_distribution.cjs --dry-run  # Preview only
 *   node execute_gold_distribution.cjs             # Execute
 */

const fs = require("fs");
const sdk = require("@multiversx/sdk-core");
const { ProxyNetworkProvider } = require("@multiversx/sdk-network-providers");
const { UserSecretKey } = require("@multiversx/sdk-wallet");

const { Address, Transaction, TransactionComputer } = sdk;

// Configuration
const NETWORK_PROVIDER = "https://gateway.multiversx.com";
const CHAIN_ID = "1";

// State file
const STATE_FILE = "/tmp/cols_distribution/gold_state.json";

// Load state
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { lastDistributionDate: null, lastTxCount: 0, nonce: null };
}

// Save state
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Check if already distributed today
function checkAlreadyDistributed(state) {
  const today = new Date().toISOString().slice(0, 10);
  
  if (state.lastDistributionDate === today) {
    console.log(`⚠️  Gold distribution already executed today: ${today}`);
    console.log(`   Txs: ${state.lastTxCount}`);
    console.log(`   To re-run, delete state file: rm ${STATE_FILE}`);
    return true;
  }
  return false;
}

// Configuration
const COLS_TOKEN_ID = "COLS-9d91b7";
const GAS_ESDT_TRANSFER = 600000;

// Load wallet
function loadWallet() {
  const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
  return UserSecretKey.fromString(keyHex);
}

// Load distribution data
function loadDistribution() {
  const files = fs.readdirSync('/tmp/cols_distribution')
    .filter(f => f.startsWith('gold_distribution_'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    throw new Error('No gold distribution file found. Run: node calculate_gold_distribution.mjs');
  }
  
  return JSON.parse(fs.readFileSync(`/tmp/cols_distribution/${files[0]}`, 'utf-8'));
}

// Helper: Convert COLS amount to hex
function colsToHex(amount) {
  let hex = BigInt(Math.floor(amount * 1e18)).toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

function stringToHex(str) {
  return Buffer.from(str).toString('hex');
}

// Build transaction
function buildTransaction(sender, recipient, amount) {
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

// Sign and send
async function signAndSend(provider, tx, secretKey) {
  const transactionComputer = new TransactionComputer();
  const serializedTx = transactionComputer.computeBytesForSigning(tx);
  const signature = secretKey.sign(serializedTx);
  tx.signature = signature;
  return await provider.sendTransaction(tx);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  
  console.log("═".repeat(70));
  console.log("👑 GOLD MEMBER DAILY DISTRIBUTION");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Dry run: ${dryRun}`);
  console.log("");
  
  // Load state and check
  const state = loadState();
  
  if (!force && checkAlreadyDistributed(state)) {
    console.log("Use --force to re-run anyway");
    process.exit(0);
  }
  
  // Setup
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER, { timeout: 30000 });
  const secretKey = loadWallet();
  const senderPublicKey = secretKey.generatePublicKey();
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
  const recipients = dist.recipients;
  const totalCols = dist.totalCols;
  
  console.log("📊 Distribution Summary:");
  console.log(`   Recipients: ${recipients.length}`);
  console.log(`   Total COLS: ${totalCols.toFixed(4)}`);
  console.log("");
  
  if (dryRun) {
    console.log("👀 DRY RUN - Preview:");
    for (const r of recipients.slice(0, 10)) {
      console.log(`   ${r.address.slice(0, 12)}... → ${r.amount.toFixed(4)} COLS`);
    }
    if (recipients.length > 10) {
      console.log(`   ... and ${recipients.length - 10} more`);
    }
    console.log("");
    console.log("✅ Dry run complete (no transactions sent)");
    process.exit(0);
  }
  
  let nonce = Number(account.nonce);
  const results = [];
  let success = 0;
  let failed = 0;
  
  console.log("═".repeat(70));
  console.log("📤 Sending transactions...");
  console.log("═".repeat(70));
  console.log("");
  
  for (const r of recipients) {
    try {
      const tx = buildTransaction(senderAddress, r.address, r.amount);
      tx.nonce = BigInt(nonce);
      
      const hash = await signAndSend(provider, tx, secretKey);
      results.push({ address: r.address, amount: r.amount, hash, status: 'success' });
      success++;
      
      console.log(`✅ ${r.address.slice(0, 8)}...${r.address.slice(-4)}: ${r.amount.toFixed(4)} COLS`);
      console.log(`   Tx: ${hash}`);
      
      nonce++;
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      results.push({ address: r.address, amount: r.amount, error: e.message, status: 'failed' });
      failed++;
      console.log(`❌ ${r.address.slice(0, 8)}...${r.address.slice(-4)}: ${e.message}`);
    }
  }
  
  console.log("");
  console.log("📊 Results:");
  console.log(`   Success: ${success}`);
  console.log(`   Failed: ${failed}`);
  console.log("");
  
  // Save state
  const newState = {
    lastDistributionDate: new Date().toISOString().slice(0, 10),
    lastTxCount: success,
    nonce: nonce,
    totalCols
  };
  saveState(newState);
  
  console.log(`✅ Gold distribution complete!`);
}

main().catch(e => {
  console.error("Error:", e.message);
  process.exit(1);
});
