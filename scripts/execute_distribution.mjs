/**
 * COLS Distribution Scripts - FIXED
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

import * as fs from "fs";
import corePkg from "@multiversx/sdk-core";
const { Address, Transaction, TransactionPayload } = corePkg;
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import walletPkg from "@multiversx/sdk-wallet";
const { UserSecretKey } = walletPkg;

// Configuration
const NETWORK_PROVIDER = "https://gateway.multiversx.com";
const CHAIN_ID = "1";

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

// Helper: Address to hex (32 bytes, not string encoding)
function addressToHex(bech32) {
  // Convert bech32 address to its 32-byte hex representation
  const addr = new (corePkg.Address)(bech32);
  return addr.pubkey().toString('hex');
}

/**
 * Build DAO distribution transaction
 * 
 * Format: ESDTTransfer@TOKEN_HEX@AMOUNT_HEX@FUNCTION_HEX@ENTITY_HEX
 * This calls the distribute() function on the PeerMe claim contract
 * which distributes tokens proportionally to all COLS stakers
 */
function buildDaoTransaction(sender, amount) {
  const tokenIdHex = stringToHex(COLS_TOKEN_ID);
  const amountHex = colsToHex(amount);
  const functionHex = stringToHex("distribute");  // IMPORTANT: Must be hex-encoded!
  const entityHex = addressToHex(COLOMBIA_ENTITY);  // Correct: 32 bytes in hex
  
  // Data format: ESDTTransfer@COLS@AMOUNT@function@entity (all hex)
  const data = `ESDTTransfer@${tokenIdHex}@${amountHex}@${functionHex}@${entityHex}`;
  
  console.log(`   Token hex: ${tokenIdHex}`);
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
    data: new TransactionPayload(Buffer.from(data))
  });
}

/**
 * Build BONUS transfer transaction
 * 
 * Format: ESDTTransfer@TOKEN_HEX@AMOUNT_HEX
 * Simple token transfer to individual address
 */
function buildBonusTransaction(sender, recipient, amount) {
  const tokenIdHex = stringToHex(COLS_TOKEN_ID);
  const amountHex = colsToHex(amount);
  
  const data = `ESDTTransfer@${tokenIdHex}@${amountHex}`;
  
  return new Transaction({
    sender: sender,
    receiver: new Address(recipient),
    value: 0n,
    gasLimit: GAS_ESDT_TRANSFER,
    chainID: CHAIN_ID,
    data: new TransactionPayload(Buffer.from(data))
  });
}

/**
 * Sign and send transaction
 */
async function signAndSend(provider, tx, secretKey) {
  const serialized = tx.serializeForSigning();
  const signature = secretKey.sign(serialized);
  tx.applySignature(signature);
  return await provider.sendTransaction(tx);
}

async function main() {
  const args = process.argv.slice(2);
  const doDao = args.includes('--dao') || args.includes('--all');
  const doBonus = args.includes('--bonus') || args.includes('--all');
  
  if (!doDao && !doBonus) {
    console.log("Usage:");
    console.log("  node execute_distribution.mjs --dao      # DAO pool only");
    console.log("  node execute_distribution.mjs --bonus    # BONUS pool only");
    console.log("  node execute_distribution.mjs --all      # Both pools");
    console.log("");
    console.log("IMPORTANT:");
    console.log("  DAO pool: Sends to PeerMe contract with distribute() call");
    console.log("  BONUS pool: Individual transfers to eligible addresses");
    process.exit(1);
  }
  
  console.log("═".repeat(70));
  console.log("🚀 COLS DISTRIBUTION EXECUTOR (FIXED)");
  console.log("═".repeat(70));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("");
  
  // Setup
  const provider = new ProxyNetworkProvider(NETWORK_PROVIDER);
  const secretKey = loadWallet();
  const senderAddress = secretKey.generatePublicKey().toAddress();
  
  console.log(`Wallet: ${senderAddress.bech32()}`);
  
  // Check balance
  const account = await provider.getAccount(senderAddress);
  console.log(`Nonce: ${account.nonce}`);
  console.log(`Balance: ${Number(account.balance) / 1e18} EGLD`);
  
  try {
    const tokens = await provider.getFungibleTokensOfAccount(senderAddress, [COLS_TOKEN_ID]);
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
  
  let nonce = account.nonce;
  const results = { dao: null, bonus: [] };
  
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
    daoTx.nonce = nonce;
    
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
      tx.nonce = nonce;
      
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
  
  // Save results
  const resultFile = `/tmp/cols_distribution/results_${new Date().toISOString().slice(0,10)}.json`;
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    dao: results.dao,
    bonus: results.bonus.slice(0, 10), // First 10 only
    bonusCount: results.bonus.length,
    totalColsDistributed: (results.dao?.amount || 0) + results.bonus.reduce((s, r) => s + r.amount, 0)
  }, null, 2));
  console.log(`\nResults saved: ${resultFile}`);
}

main().catch(console.error);