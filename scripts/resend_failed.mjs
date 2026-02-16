/**
 * Resend Failed COLS Transactions
 * 
 * This script resends transactions that failed due to odd-length hex encoding.
 * Failed transactions are loaded from /tmp/cols_distribution/failed_transactions.json
 */

import * as fs from "fs";
import corePkg from "@multiversx/sdk-core";
const { Address, Transaction, TransactionPayload } = corePkg;
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import walletPkg from "@multiversx/sdk-wallet";
const { UserSecretKey } = walletPkg;

// Configuration
const NETWORK_PROVIDER = "https://gateway.multiversx.com";
const COLS_TOKEN_ID = "COLS-9d91b7";
const GAS_LIMIT_TRANSFER = 600000;

// Load wallet
function loadWallet() {
  const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
  return UserSecretKey.fromString(keyHex);
}

// Build ESDT transfer data with proper padding
function buildESDTTransfer(tokenId, amount) {
  const tokenIdHex = Buffer.from(tokenId).toString('hex');
  let amountHex = BigInt(Math.floor(amount * 1e18)).toString(16);
  // CRITICAL: Ensure even length for valid bytecode
  if (amountHex.length % 2 !== 0) amountHex = '0' + amountHex;
  return `ESDTTransfer@${tokenIdHex}@${amountHex}`;
}

async function main() {
  console.log("═".repeat(70));
  console.log("🔄 RESENDING FAILED TRANSACTIONS");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");

  // Load failed transactions
  const failedPath = '/tmp/cols_distribution/failed_transactions.json';
  if (!fs.existsSync(failedPath)) {
    console.error("❌ No failed_transactions.json found");
    process.exit(1);
  }
  
  const failedTxs = JSON.parse(fs.readFileSync(failedPath, 'utf-8'));
  console.log(`Loaded ${failedTxs.length} failed transactions`);
  
  const totalAmount = failedTxs.reduce((sum, tx) => sum + tx.amount, 0);
  console.log(`Total amount to resend: ${totalAmount.toFixed(10)} COLS`);
  console.log("");

  // Setup
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER);
  const secretKey = loadWallet();
  const senderAddress = secretKey.generatePublicKey().toAddress();
  
  // Check balance
  const account = await provider.getAccount(senderAddress);
  console.log(`Wallet: ${senderAddress.bech32()}`);
  console.log(`Nonce: ${account.nonce}`);
  console.log(`Balance: ${Number(account.balance) / 1e18} EGLD`);
  
  try {
    const tokens = await provider.getFungibleTokensOfAccount(senderAddress, [COLS_TOKEN_ID]);
    console.log(`COLS Balance: ${Number(tokens[0]?.balance || 0n) / 1e18}`);
  } catch (e) {
    console.log(`COLS Balance: Unable to fetch`);
  }
  console.log("");

  // Confirm before proceeding
  console.log("⚠️  About to send " + failedTxs.length + " transactions");
  console.log("⚠️  Total COLS: " + totalAmount.toFixed(6));
  console.log("");
  console.log("First 5 recipients:");
  failedTxs.slice(0, 5).forEach((tx, i) => {
    console.log(`  ${i+1}. ${tx.recipient.slice(0,20)}... → ${tx.amount.toFixed(8)} COLS`);
  });
  console.log("");
  
  // Proceed with sending
  let nonce = account.nonce;
  let success = 0;
  let fail = 0;
  const results = [];

  console.log("Sending transactions...");
  console.log("");

  for (let i = 0; i < failedTxs.length; i++) {
    const tx = failedTxs[i];
    const data = buildESDTTransfer(COLS_TOKEN_ID, tx.amount);
    
    // Verify hex is even length
    const hexLen = data.split('@')[2].length;
    if (hexLen % 2 !== 0) {
      console.error(`  ❌ [${i+1}/${failedTxs.length}] ODD HEX LENGTH: ${tx.recipient.slice(0,12)}...`);
      fail++;
      continue;
    }

    const transaction = new Transaction({
      sender: senderAddress,
      receiver: new Address(tx.recipient),
      value: 0n,
      gasLimit: GAS_LIMIT_TRANSFER,
      chainID: "1",
      nonce: nonce,
      data: new TransactionPayload(Buffer.from(data))
    });

    const serialized = transaction.serializeForSigning();
    const signature = secretKey.sign(serialized);
    transaction.applySignature(signature);

    try {
      const hash = await provider.sendTransaction(transaction);
      results.push({ hash, recipient: tx.recipient, amount: tx.amount });
      success++;
      
      if (success <= 5 || success % 10 === 0 || success === failedTxs.length) {
        console.log(`  ✅ [${success}/${failedTxs.length}] ${tx.recipient.slice(0,12)}... → ${tx.amount.toFixed(8)} COLS`);
      }
    } catch (e) {
      console.error(`  ❌ [${i+1}/${failedTxs.length}] ${tx.recipient.slice(0,12)}... → ${e.message}`);
      fail++;
    }

    nonce++;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("");
  console.log("═".repeat(70));
  console.log("🎉 RESEND COMPLETE");
  console.log("═".repeat(70));
  console.log(`Success: ${success}`);
  console.log(`Failed: ${fail}`);
  console.log(`Total COLS sent: ${results.reduce((s, r) => s + r.amount, 0).toFixed(6)}`);

  // Save results
  const resultPath = '/tmp/cols_distribution/resend_results.json';
  fs.writeFileSync(resultPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalSent: results.length,
    totalFailed: fail,
    amountSent: results.reduce((s, r) => s + r.amount, 0),
    transactions: results
  }, null, 2));
  console.log(`\nResults saved: ${resultPath}`);
}

main().catch(console.error);