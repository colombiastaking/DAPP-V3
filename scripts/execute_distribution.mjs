import { Address, Transaction, TransactionPayload, TokenIdentifierValue, BigUIntValue } from "@multiversx/sdk-core";
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import { UserSigner, UserSecretKey } from "@multiversx/sdk-wallet";
import * as fs from "fs";

// Configuration
const NETWORK_PROVIDER = "https://api.multiversx.com";
const CHAIN_ID = "1"; // Mainnet

// Contract addresses
const COLS_TOKEN = "COLS-744718";
const CLAIM_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";

// Distribution parameters
const TOTAL_DAILY_COLS = 35.29;
const DAO_POOL_RATIO = 0.333;
const BONUS_POOL_RATIO = 0.667;

// Load wallet
const walletPath = "/home/raspberry/.openclaw/wallet/.private_key";
const privateKeyHex = fs.readFileSync(walletPath, "utf-8").trim();
const secretKey = UserSecretKey.fromString(privateKeyHex);
const signer = new UserSigner(secretKey);
const aliceAddress = signer.getAddress();

console.log("=== COLS DISTRIBUTION BOT ===");
console.log("Wallet:", aliceAddress.bech32());
console.log("Date:", new Date().toISOString().split('T')[0]);

const provider = new ProxyNetworkProvider(NETWORK_PROVIDER);

async function checkBalance() {
  try {
    const account = await provider.getAccount(aliceAddress);
    const balance = Number(account.balance) / 1e18;
    console.log(`Alice EGLD Balance: ${balance.toFixed(4)} EGLD`);
    return { balance, nonce: account.nonce };
  } catch (e) {
    console.error("Error checking balance:", e.message);
    return { balance: 0, nonce: 0 };
  }
}

// Load distribution data
function loadDistributionData() {
  const bonusesPath = "/tmp/distribution_list.txt";
  if (!fs.existsSync(bonusesPath)) {
    console.error("Distribution file not found:", bonusesPath);
    return [];
  }
  
  const lines = fs.readFileSync(bonusesPath, "utf-8").split("\n");
  const amounts = [];
  let total = 0;
  
  for (const line of lines) {
    if (!line.trim()) continue;
    const [address, amount] = line.split(";");
    if (address && amount) {
      const amt = parseFloat(amount);
      amounts.push({ address, amount: amt });
      total += amt;
    }
  }
  
  console.log(`Loaded ${amounts.length} recipients, total: ${total.toFixed(4)} COLS`);
  return amounts;
}

// Create COLS transfer transaction
function createColsTransfer(nonce, recipient, amount) {
  const amountBig = BigInt(Math.floor(amount * 1e18));
  
  // ESDT transfer data: ESDTTransfer@token@amount
  const data = `ESDTTransfer@${Buffer.from(COLS_TOKEN).toString("hex")}@${amountBig.toString(16)}`;
  
  return new Transaction({
    nonce: nonce,
    value: 0n,
    receiver: new Address(recipient),
    sender: aliceAddress,
    gasLimit: 500000n,
    chainID: CHAIN_ID,
    data: TransactionPayload.fromEncoded(data)
  });
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  console.log("\n📊 Checking wallet status...");
  const { balance, nonce } = await checkBalance();
  
  if (balance < 0.1) {
    console.error("⚠️  WARNING: Alice may not have enough EGLD for gas!");
    console.error("Please ensure Alice has at least 0.5 EGLD for transactions.");
  }
  
  console.log("\n📋 Loading distribution data...");
  const recipients = loadDistributionData();
  
  if (recipients.length === 0) {
    console.error("No recipients loaded. Run the calculation first.");
    return;
  }
  
  // Show summary
  const daoPool = TOTAL_DAILY_COLS * DAO_POOL_RATIO;
  const bonusPool = TOTAL_DAILY_COLS * BONUS_POOL_RATIO;
  
  console.log("\n" + "=".repeat(60));
  console.log("📊 DISTRIBUTION SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Daily: ${TOTAL_DAILY_COLS} COLS`);
  console.log(`DAO Pool (1/3): ${daoPool.toFixed(2)} COLS → Smart Contract`);
  console.log(`Bonus Pool (2/3): ${bonusPool.toFixed(2)} COLS → ${recipients.length} recipients`);
  console.log("=".repeat(60));
  
  // Calculate gas costs
  const avgGasPerTransfer = 500000;
  const transfers = recipients.length;
  const totalGas = transfers * avgGasPerTransfer;
  const gasInEgld = totalGas / 1e18 * 0.05;
  
  console.log(`\n⛽ Estimated Gas: ${totalGas.toLocaleString()} units (~${gasInEgld.toFixed(4)} EGLD minimum)`);
  
  // Dry run mode
  if (args.includes("--dry-run") || args.includes("--preview")) {
    console.log("\n🔍 DRY RUN MODE - No transactions will be sent");
    console.log("\nFirst 10 transactions:");
    console.log("-".repeat(60));
    for (let i = 0; i < 10 && i < recipients.length; i++) {
      const tx = createColsTransfer(nonce + i, recipients[i].address, recipients[i].amount);
      console.log(`  ${i+1}. ${recipients[i].address}`);
      console.log(`     Amount: ${recipients[i].amount.toFixed(6)} COLS`);
      console.log(`     Gas: ${tx.gasLimit}`);
    }
    console.log("-".repeat(60));
    console.log(`  ... and ${recipients.length - 10} more transactions`);
    console.log(`\n📊 Total transactions: ${recipients.length}`);
    console.log(`📊 Total COLS to distribute: ${bonusPool.toFixed(4)} COLS`);
    return;
  }
  
  // Execute mode requires --execute flag
  if (!args.includes("--execute")) {
    console.log("\n⚠️  Run with --execute to send transactions");
    console.log("⚠️  Run with --dry-run to preview transactions");
    return;
  }
  
  console.log("\n🚀 EXECUTING DISTRIBUTION...");
  console.log("This will send " + recipients.length + " transactions.");
  console.log("Press Ctrl+C to abort within 5 seconds...");
  await new Promise(r => setTimeout(r, 5000));
  
  let currentNonce = nonce;
  let sentCount = 0;
  let totalSent = 0;
  const errors = [];
  
  for (const recipient of recipients) {
    try {
      const tx = createColsTransfer(currentNonce, recipient.address, recipient.amount);
      
      // Sign transaction
      const serializedTx = tx.serializeForSigning(aliceAddress);
      const signature = await signer.sign(serializedTx);
      tx.applySignature(signature);
      
      // Send transaction
      const txHash = await provider.sendTransaction(tx);
      console.log(`✅ [${sentCount + 1}/${recipients.length}] ${recipient.amount.toFixed(6)} COLS → ${recipient.address.substring(0, 20)}... (${txHash})`);
      
      currentNonce++;
      sentCount++;
      totalSent += recipient.amount;
      
      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
      
    } catch (error) {
      console.error(`❌ Error sending to ${recipient.address}:`, error.message);
      errors.push({ address: recipient.address, error: error.message });
      // Don't increment nonce on error - will retry with same nonce
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DISTRIBUTION COMPLETE");
  console.log("=".repeat(60));
  console.log(`Transactions sent: ${sentCount}/${recipients.length}`);
  console.log(`Total COLS distributed: ${totalSent.toFixed(4)} COLS`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    console.log("Failed addresses:", errors.map(e => e.address.substring(0, 20)).join(", "));
  }
  console.log("=".repeat(60));
}

main().catch(console.error);