import * as fs from "fs";
import corePkg from "@multiversx/sdk-core";
const { Account, Address, Transaction, TransactionPayload } = corePkg;
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import walletPkg from "@multiversx/sdk-wallet";
const { UserSecretKey } = walletPkg;

// Configuration
const NETWORK_PROVIDER = "https://gateway.multiversx.com";
const COLS_TOKEN_ID = "COLS-9d91b7";
const DAO_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";
const GAS_LIMIT_TRANSFER = 600000;

// Load wallet
function loadWallet() {
  const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
  return UserSecretKey.fromString(keyHex);
}

// Load bonus distribution
function loadDistribution() {
  const files = fs.readdirSync('/tmp/cols_distribution')
    .filter(f => f.startsWith('bonus_distribution_'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    throw new Error('No distribution file found. Run calculation first.');
  }
  
  const data = JSON.parse(fs.readFileSync(`/tmp/cols_distribution/${files[0]}`, 'utf-8'));
  return data;
}

// Build ESDT transfer data
function buildESDTTransfer(tokenId, amount) {
  const tokenIdHex = Buffer.from(tokenId).toString('hex');
  let amountHex = BigInt(Math.floor(amount * 1e18)).toString(16);
  // CRITICAL: Ensure even length for valid bytecode
  if (amountHex.length % 2 !== 0) amountHex = '0' + amountHex;
  return `ESDTTransfer@${tokenIdHex}@${amountHex}`;
}

async function main() {
  console.log("═".repeat(70));
  console.log("🚀 COLS DISTRIBUTION EXECUTOR");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log();

  // Setup
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER);
  const secretKey = loadWallet();
  const senderAddress = secretKey.generatePublicKey().toAddress();
  
  console.log(`Wallet: ${senderAddress.bech32()}`);
  
  // Check balance
  const accountOnNetwork = await provider.getAccount(senderAddress);
  console.log(`Nonce: ${accountOnNetwork.nonce}`);
  console.log(`Balance: ${Number(accountOnNetwork.balance) / 1e18} EGLD`);
  
  try {
    const tokens = await provider.getFungibleTokensOfAccount(senderAddress, [COLS_TOKEN_ID]);
    const colsBalance = tokens[0]?.balance || 0n;
    console.log(`COLS Balance: ${Number(colsBalance) / 1e18}`);
  } catch (e) {
    console.log(`COLS Balance: Unable to fetch (will proceed anyway)`);
  }
  console.log();
  
  // Load distribution
  const distribution = loadDistribution();
  const recipients = distribution.bonus.recipients;
  const totalBonus = distribution.bonus.totalBonus;
  
  // Calculate DAO amount (1/3 of total buyback)
  const totalBuyback = totalBonus / 0.667;
  const daoAmount = totalBuyback * 0.333;
  
  console.log("📊 Distribution Summary:");
  console.log(`   Bonus Pool: ${totalBonus.toFixed(6)} COLS to ${recipients.length} addresses`);
  console.log(`   DAO Pool: ${daoAmount.toFixed(6)} COLS to PeerMe contract`);
  console.log(`   Total needed: ${(totalBonus + daoAmount).toFixed(6)} COLS`);
  console.log();
  
  let nonce = accountOnNetwork.nonce;
  const txHashes = [];
  
  // ============================================
  // PART 1: Send DAO pool to PeerMe contract
  // ============================================
  console.log("════════════════════════════════════════════════════════════════");
  console.log("🔴 PART 1: DAO Pool Distribution");
  console.log("════════════════════════════════════════════════════════════════");
  console.log();
  
  const daoData = buildESDTTransfer(COLS_TOKEN_ID, daoAmount);
  console.log(`Sending ${daoAmount.toFixed(6)} COLS to PeerMe DAO...`);
  
  const daoTx = new Transaction({
    sender: senderAddress,
    receiver: new Address(DAO_CONTRACT),
    value: 0n,
    gasLimit: GAS_LIMIT_TRANSFER,
    chainID: "1",
    nonce: nonce,
    data: new TransactionPayload(Buffer.from(daoData))
  });
  
  const daoSerialized = daoTx.serializeForSigning();
  const daoSignature = secretKey.sign(daoSerialized);
  daoTx.applySignature(daoSignature);
  
  try {
    const daoTxHash = await provider.sendTransaction(daoTx);
    txHashes.push({ type: 'DAO', hash: daoTxHash, amount: daoAmount });
    console.log(`✅ DAO Transfer: ${daoAmount.toFixed(6)} COLS → PeerMe Contract`);
    console.log(`   TX: ${daoTxHash}`);
    console.log(`   Explorer: https://explorer.multiversx.com/transactions/${daoTxHash}`);
  } catch (e) {
    console.error(`❌ DAO Transfer failed: ${e.message}`);
    throw e;
  }
  
  nonce++;
  await new Promise(r => setTimeout(r, 500));
  
  // ============================================
  // PART 2: Bonus distribution to delegators
  // ============================================
  console.log();
  console.log("════════════════════════════════════════════════════════════════");
  console.log("🟢 PART 2: Bonus Pool Distribution");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(`Sending ${recipients.length} transactions...`);
  console.log();
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    const amount = recipient.amount;
    const txData = buildESDTTransfer(COLS_TOKEN_ID, amount);
    
    const tx = new Transaction({
      sender: senderAddress,
      receiver: new Address(recipient.address),
      value: 0n,
      gasLimit: GAS_LIMIT_TRANSFER,
      chainID: "1",
      nonce: nonce,
      data: new TransactionPayload(Buffer.from(txData))
    });
    
    const serialized = tx.serializeForSigning();
    const signature = secretKey.sign(serialized);
    tx.applySignature(signature);
    
    try {
      const txHash = await provider.sendTransaction(tx);
      txHashes.push({ type: 'BONUS', hash: txHash, recipient: recipient.address, amount });
      successCount++;
      
      if (successCount <= 5 || successCount % 20 === 0 || i === recipients.length - 1) {
        console.log(`  ✅ [${successCount}/${recipients.length}] ${recipient.address.slice(0,12)}... → ${amount.toFixed(6)} COLS`);
      }
    } catch (e) {
      console.error(`  ❌ ${recipient.address.slice(0,12)}... → ${e.message}`);
      failCount++;
    }
    
    nonce++;
    await new Promise(r => setTimeout(r, 100));
  }
  
  // Summary
  console.log();
  console.log("═".repeat(70));
  console.log("🎉 DISTRIBUTION COMPLETE");
  console.log("═".repeat(70));
  console.log();
  
  const daoTxs = txHashes.filter(t => t.type === 'DAO');
  
  console.log(`DAO Transfer: ${daoTxs.length}`);
  console.log(`Bonus Transfers: ${successCount} successful, ${failCount} failed`);
  console.log(`Total COLS Distributed: ${txHashes.reduce((s, t) => s + t.amount, 0).toFixed(6)}`);
  
  // Save results
  const results = {
    timestamp: new Date().toISOString(),
    distribution: distribution.bonus,
    daoPool: { amount: daoAmount, txHash: daoTxs[0]?.hash },
    totalTransactions: txHashes.length,
    successCount,
    failCount,
    totalDistributed: txHashes.reduce((s, t) => s + t.amount, 0),
    transactions: txHashes
  };
  
  fs.writeFileSync('/tmp/cols_distribution/distribution_results.json', JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to /tmp/cols_distribution/distribution_results.json`);
  
  // Show explorer link for DAO tx
  console.log("\n📋 DAO Transaction:");
  daoTxs.forEach(t => {
    console.log(`  https://explorer.multiversx.com/transactions/${t.hash}`);
  });
  
  console.log("\n📋 First 5 Bonus Transactions:");
  txHashes.filter(t => t.type === 'BONUS').slice(0, 5).forEach(t => {
    console.log(`  ${t.recipient.slice(0,12)}... → ${t.amount.toFixed(6)} COLS`);
    console.log(`    https://explorer.multiversx.com/transactions/${t.hash}`);
  });
}

main().catch(console.error);