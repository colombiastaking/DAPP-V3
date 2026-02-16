import * as fs from "fs";
import {
  Account,
  Address,
  AddressValue,
  BigUIntValue,
  ContractCallPayloadBuilder,
  ContractFunction,
  GasEstimator,
  ITransactionOnNetwork,
  NetworkConfig,
  NetworkParams,
  SecretKey,
  SignableMessage,
  Transaction,
  TransactionComputer,
  TransactionHash,
  TokenIdentifierValue,
  TransactionsFactoryConfig,
  ESDTTransferPayloadBuilder,
  Token,
  TokenTransfer
} from "@multiversx/sdk-core";
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";

// Configuration
const NETWORK_PROVIDER = "https://gateway.multiversx.com";
const COLS_TOKEN_ID = "COLS-9d91b7";
const GAS_LIMIT_ESDT_TRANSFORMER = 500000;
const GAS_LIMIT_TRANSFER = 500000;

// Load private key
function loadPrivateKey() {
  const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
  return SecretKey.fromString(keyHex);
}

// Load distribution list
function loadBonusRecipients() {
  const data = fs.readFileSync('/tmp/distribution_full_v4.json', 'utf-8');
  const json = JSON.parse(data);
  return json.bonusRecipients;
}

async function main() {
  console.log("═".repeat(70));
  console.log("🚀 EXECUTING BONUS POOL DISTRIBUTION");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log();

  // Setup
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER);
  const secretKey = loadPrivateKey();
  const aliceAddress = secretKey.toPublicKey().toAddress();
  
  console.log(`Wallet: ${aliceAddress.bech32()}`);
  
  // Check balance
  const accountOnNetwork = await provider.getAccount(aliceAddress);
  console.log(`Nonce: ${accountOnNetwork.nonce}`);
  console.log(`Balance: ${Number(accountOnNetwork.balance) / 1e18} EGLD`);
  
  const tokens = await provider.getFungibleTokensOfAccount(aliceAddress, [COLS_TOKEN_ID]);
  const colsBalance = tokens[0]?.balance || 0n;
  console.log(`COLS Balance: ${Number(colsBalance) / 1e18}`);
  console.log();
  
  // Load recipients
  const recipients = loadBonusRecipients();
  const totalAmount = recipients.reduce((s, r) => s + r.dailyBonus, 0);
  
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Total COLS: ${totalAmount.toFixed(6)}`);
  console.log();
  
  // Verify sufficient balance
  if (Number(colsBalance) < totalAmount * 1e18) {
    throw new Error(`Insufficient COLS balance. Need ${totalAmount.toFixed(2)}, have ${Number(colsBalance)/1e18}`);
  }
  
  // Create account with correct nonce
  const account = new Account(aliceAddress);
  account.update(accountOnNetwork);
  
  // Get network config
  const networkConfig = await provider.getNetworkConfig();
  
  // Prepare transactions
  console.log("Preparing transactions...");
  const txComputer = new TransactionComputer();
  
  // Process in batches of 90 (EGLD transaction limit per block)
  const batchSize = 90;
  const batches = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }
  
  console.log(`Total batches: ${batches.length}`);
  console.log();
  
  const txHashes = [];
  
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`--- Batch ${batchIndex + 1}/${batches.length} (${batch.length} recipients) ---`);
    
    for (const recipient of batch) {
      const amountBigInt = BigInt(Math.floor(recipient.dailyBonus * 1e18));
      
      // Build ESDT transfer transaction
      const tx = new Transaction({
        sender: aliceAddress,
        receiver: new Address(recipient.address),
        value: 0n,
        gasLimit: GAS_LIMIT_TRANSFER,
        chainID: networkConfig.chainID,
        nonce: account.nonce,
        data: (() => {
          const token = new Token({ identifier: COLS_TOKEN_ID });
          const transfer = TokenTransfer.fungibleFromAmount(token, recipient.dailyBonus.toString(), 18);
          const builder = new ESDTTransferPayloadBuilder();
          builder.addTransfer(transfer);
          return builder.build();
        })()
      });
      
      // Sign transaction
      const serializedTx = txComputer.computeBytesForSigning(tx);
      const signature = secretKey.sign(serializedTx);
      txComputer.applySignature(tx, signature);
      
      // Broadcast
      try {
        const txHash = await provider.sendTransaction(tx);
        txHashes.push({ hash: txHash, recipient: recipient.address, amount: recipient.dailyBonus });
        console.log(`  ✅ ${recipient.address.slice(0,20)}... → ${recipient.dailyBonus.toFixed(6)} COLS (${txHash})`);
      } catch (e) {
        console.error(`  ❌ ${recipient.address.slice(0,20)}... → ${e.message}`);
      }
      
      // Increment nonce for next transaction
      account.incrementNonce();
      
      // Small delay between transactions
      await new Promise(r => setTimeout(r, 200));
    }
    
    console.log();
  }
  
  // Summary
  console.log("═".repeat(70));
  console.log("DISTRIBUTION COMPLETE");
  console.log("═".repeat(70));
  console.log();
  console.log(`Total transactions: ${txHashes.length}`);
  console.log(`Total COLS distributed: ${txHashes.reduce((s, t) => s + t.amount, 0).toFixed(6)}`);
  
  // Save results
  fs.writeFileSync('/tmp/bonus_distribution_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTransactions: txHashes.length,
    totalDistributed: txHashes.reduce((s, t) => s + t.amount, 0),
    transactions: txHashes
  }, null, 2));
  
  console.log(`\n✅ Results saved to /tmp/bonus_distribution_results.json`);
}

main().catch(console.error);
