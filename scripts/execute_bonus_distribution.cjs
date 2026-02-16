const fs = require("fs");

async function main() {
  // Dynamic imports
  const { ProxyNetworkProvider } = await import("@multiversx/sdk-network-providers");
  const { Address, Transaction, TransactionPayload } = await import("@multiversx/sdk-core");
  const { UserSecretKey } = await import("@multiversx/sdk-wallet");

  // Configuration
  const NETWORK_PROVIDER = "https://gateway.multiversx.com";
  const COLS_TOKEN_ID = "COLS-9d91b7";
  const GAS_LIMIT = 500000;
  const CHAIN_ID = "1"; // Mainnet

  console.log("═".repeat(70));
  console.log("🚀 EXECUTING BONUS POOL DISTRIBUTION");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log();

  // Setup provider
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER);
  
  // Load private key (hex format)
  const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
  const secretKey = UserSecretKey.fromString(keyHex);
  const publicKey = secretKey.generatePublicKey();
  const aliceAddress = publicKey.toAddress();
  
  console.log(`Wallet: ${aliceAddress.bech32()}`);
  
  // Check balance
  const accountOnNetwork = await provider.getAccount(aliceAddress);
  console.log(`Nonce: ${accountOnNetwork.nonce}`);
  console.log(`EGLD Balance: ${Number(accountOnNetwork.balance) / 1e18}`);
  
  const tokens = await provider.getFungibleTokensOfAccount(aliceAddress, [COLS_TOKEN_ID]);
  const colsBalance = tokens[0]?.balance || 0n;
  console.log(`COLS Balance: ${Number(colsBalance) / 1e18}`);
  console.log();
  
  // Load recipients
  const recipientsData = JSON.parse(fs.readFileSync('/tmp/distribution_full_v4.json', 'utf-8'));
  const recipients = recipientsData.bonusRecipients;
  const totalAmount = recipients.reduce((s, r) => s + r.dailyBonus, 0);
  
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Total COLS to distribute: ${totalAmount.toFixed(6)}`);
  console.log();

  // Verify sufficient balance
  if (Number(colsBalance) < totalAmount * 1e18) {
    throw new Error(`Insufficient COLS balance. Need ${totalAmount.toFixed(2)}, have ${Number(colsBalance)/1e18}`);
  }
  
  const txHashes = [];
  let successCount = 0;
  let failCount = 0;
  let currentNonce = accountOnNetwork.nonce;
  
  console.log("Sending transactions...");
  console.log();
  
  for (const recipient of recipients) {
    const amountBigInt = BigInt(Math.floor(recipient.dailyBonus * 1e18));
    
    // Build ESDT transfer data
    // Format: ESDTTransfer@<token_hex>@<amount_hex>
    const tokenHex = Buffer.from(COLS_TOKEN_ID).toString('hex');
    const amountHex = amountBigInt.toString(16);
    const dataStr = `ESDTTransfer@${tokenHex}@${amountHex}`;
    const payload = new TransactionPayload(dataStr);
    
    const tx = new Transaction({
      sender: aliceAddress,
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
      console.log(`✅ [${successCount}/${recipients.length}] ${recipient.address.slice(0,20)}... → ${recipient.dailyBonus.toFixed(4)} COLS (${txHash.toString().slice(0,10)}...)`);
    } catch (e) {
      failCount++;
      console.error(`❌ ${recipient.address.slice(0,20)}... → ${e.message}`);
    }
    
    // Increment nonce for next transaction
    currentNonce++;
    
    // Small delay between transactions (300ms)
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Summary
  console.log();
  console.log("═".repeat(70));
  console.log("DISTRIBUTION COMPLETE");
  console.log("═".repeat(70));
  console.log();
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Total COLS distributed: ${txHashes.reduce((s, t) => s + t.amount, 0).toFixed(6)}`);
  
  // Save results
  fs.writeFileSync('/tmp/bonus_distribution_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    successCount,
    failCount,
    totalDistributed: txHashes.reduce((s, t) => s + t.amount, 0),
    transactions: txHashes
  }, null, 2));
  
  console.log(`\n✅ Results saved to /tmp/bonus_distribution_results.json`);
}

main().catch(console.error);
