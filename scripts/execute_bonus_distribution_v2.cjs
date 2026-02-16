/**
 * BONUS Pool Distribution Script v2 - FIXED
 * 
 * FIX: Pad hex amounts to even length
 * Problem was that amounts with odd-length hex caused malformed transactions
 *   - Example: 0.85 COLS = bd728550323b000 (15 chars = ODD = INVALID)
 *   - Fixed:  0.85 COLS = 0bd728550323b000 (16 chars = EVEN = VALID)
 * 
 * Run with: node execute_bonus_distribution_v2.cjs
 */

const fs = require("fs");

async function main() {
  // Dynamic imports
  const { ProxyNetworkProvider } = await import("@multiversx/sdk-network-providers");
  const { Address, Transaction, TransactionPayload } = await import("@multiversx/sdk-core");
  const { UserSecretKey } = await import("@multiversx/sdk-wallet");

  // Configuration
  const NETWORK_PROVIDER = "https://gateway.multiversx.com";
  const COLS_TOKEN_ID = "COLS-9d91b7";
  const GAS_LIMIT = 500000;      // Fixed gas limit for ESDT transfers
  const CHAIN_ID = "1";          // Mainnet

  console.log("═".repeat(70));
  console.log("🚀 BONUS POOL DISTRIBUTION v2 (FIXED)");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log();

  // Setup provider
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER);
  
  // Load private key
  const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
  const secretKey = UserSecretKey.fromString(keyHex);
  const publicKey = secretKey.generatePublicKey();
  const senderAddress = publicKey.toAddress();
  
  console.log(`Sender Wallet: ${senderAddress.bech32()}`);
  console.log("⚠️  DRY RUN MODE - No transactions will be sent unless --execute flag is provided");
  console.log();
  
  // Check balance
  const accountOnNetwork = await provider.getAccount(senderAddress);
  console.log(`Nonce: ${accountOnNetwork.nonce}`);
  console.log(`EGLD Balance: ${Number(accountOnNetwork.balance) / 1e18}`);
  
  const tokens = await provider.getFungibleTokensOfAccount(senderAddress, [COLS_TOKEN_ID]);
  const colsBalance = tokens[0]?.balance || 0n;
  console.log(`COLS Balance: ${Number(colsBalance) / 1e18}`);
  console.log();
  
  // Load recipients from distribution file
  const recipientsData = JSON.parse(fs.readFileSync('/tmp/distribution_full_v4.json', 'utf-8'));
  const recipients = recipientsData.bonusRecipients;
  const totalAmount = recipients.reduce((s, r) => s + r.dailyBonus, 0);
  
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Total COLS to distribute: ${totalAmount.toFixed(6)}`);
  console.log();

  // Helper: Convert amount to properly padded hex string
  function amountToHex(amountCols) {
    const amountBigInt = BigInt(Math.floor(amountCols * 1e18));
    let hexStr = amountBigInt.toString(16);
    
    // CRITICAL FIX: Pad with leading zero if length is odd
    if (hexStr.length % 2 !== 0) {
      hexStr = '0' + hexStr;
    }
    
    return hexStr;
  }

  // Verify sufficient balance
  if (Number(colsBalance) < totalAmount * 1e18) {
    throw new Error(`Insufficient COLS balance. Need ${totalAmount.toFixed(2)}, have ${Number(colsBalance)/1e18}`);
  }
  
  // Build ESDT transfer data
  const tokenHex = Buffer.from(COLS_TOKEN_ID).toString('hex');
  
  // Check for execute flag
  const shouldExecute = process.argv.includes('--execute');
  
  if (!shouldExecute) {
    console.log("═".repeat(70));
    console.log("📋 DRY RUN - Preview of transactions");
    console.log("═".repeat(70));
    console.log();
    
    console.log("First 10 transactions:");
    for (let i = 0; i < 10 && i < recipients.length; i++) {
      const r = recipients[i];
      const amountHex = amountToHex(r.dailyBonus);
      const dataStr = `ESDTTransfer@${tokenHex}@${amountHex}`;
      
      console.log(`  [${i}] ${r.address.slice(0,20)}...`);
      console.log(`       Amount: ${r.dailyBonus.toFixed(6)} COLS`);
      console.log(`       Hex: ${amountHex} (${amountHex.length} chars, ${amountHex.length % 2 === 0 ? 'EVEN ✓' : 'ODD ✗'})`);
      console.log(`       Data: ${dataStr.slice(0,60)}...`);
    }
    
    console.log();
    console.log("Last 3 transactions:");
    for (let i = recipients.length - 3; i < recipients.length; i++) {
      const r = recipients[i];
      const amountHex = amountToHex(r.dailyBonus);
      
      console.log(`  [${i}] ${r.address.slice(0,20)}...`);
      console.log(`       Amount: ${r.dailyBonus.toFixed(10)} COLS`);
      console.log(`       Hex: ${amountHex} (${amountHex.length} chars, ${amountHex.length % 2 === 0 ? 'EVEN ✓' : 'ODD ✗'})`);
    }
    
    console.log();
    console.log("═".repeat(70));
    console.log(`Total: ${recipients.length} transactions, ${totalAmount.toFixed(6)} COLS`);
    console.log("═".repeat(70));
    console.log();
    console.log("To execute, run with --execute flag");
    return;
  }
  
  // EXECUTE MODE
  console.log("═".repeat(70));
  console.log("⚠️  EXECUTE MODE - Transactions will be sent!");
  console.log("═".repeat(70));
  console.log();
  
  let currentNonce = accountOnNetwork.nonce;
  const txHashes = [];
  let successCount = 0;
  let failCount = 0;
  
  for (const recipient of recipients) {
    const amountHex = amountToHex(recipient.dailyBonus);
    const dataStr = `ESDTTransfer@${tokenHex}@${amountHex}`;
    const payload = new TransactionPayload(dataStr);
    
    const tx = new Transaction({
      sender: senderAddress,
      receiver: new Address(recipient.address),
      value: 0n,
      gasLimit: GAS_LIMIT,
      chainID: CHAIN_ID,
      nonce: currentNonce,
      data: payload
    });
    
    // Sign transaction
    const serializedTx = tx.serializeForSigning();
    const signature = secretKey.sign(serializedTx);
    tx.applySignature(signature);
    
    // Broadcast
    try {
      const txHash = await provider.sendTransaction(tx);
      txHashes.push({ hash: txHash.toString(), recipient: recipient.address, amount: recipient.dailyBonus });
      successCount++;
      console.log(`✅ [${successCount}/${recipients.length}] ${recipient.address.slice(0,20)}... → ${recipient.dailyBonus.toFixed(6)} COLS`);
    } catch (e) {
      failCount++;
      console.error(`❌ ${recipient.address.slice(0,20)}... → ${e.message}`);
    }
    
    currentNonce++;
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Summary
  console.log();
  console.log("═".repeat(70));
  console.log("DISTRIBUTION COMPLETE");
  console.log("═".repeat(70));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Total COLS distributed: ${txHashes.reduce((s, t) => s + t.amount, 0).toFixed(6)}`);
  
  fs.writeFileSync('/tmp/bonus_distribution_results_v2.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    successCount,
    failCount,
    totalDistributed: txHashes.reduce((s, t) => s + t.amount, 0),
    transactions: txHashes
  }, null, 2));
  
  console.log(`\n✅ Results saved to /tmp/bonus_distribution_results_v2.json`);
}

main().catch(console.error);