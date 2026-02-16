#!/usr/bin/env node
/**
 * Register Herotag (Username) on MultiversX Blockchain
 * 
 * This registers a PUBLIC herotag for the distribution wallet
 * so recipients see "AliceColombiaStaking" as sender name.
 * 
 * Contract: erd1qqqqqqqqqqqqqpgqn66rjx09amx3x77slvrhsak6508x9qg4u7zsch0ufs
 * Function: setUsername
 */

import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Use require for CommonJS modules
const { Address, Transaction, TransactionPayload } = require('@multiversx/sdk-core');
const { ProxyNetworkProvider } = require('@multiversx/sdk-network-providers');
const { UserSigner, UserSecretKey } = require('@multiversx/sdk-wallet');

const CONFIG = {
  provider: 'https://gateway.multiversx.com',
  chainId: '1',
  privateKeyPath: '/home/raspberry/.openclaw/alice-backup/wallet/private_key.txt',
  herotag: 'AliceColombiaStaking',
  // Username contract on MultiversX
  usernameContract: 'erd1qqqqqqqqqqqqqpgqn66rjx09amx3x77slvrhsak6508x9qg4u7zsch0ufs',
  gasLimit: 10000000,
};

const stringToHex = (str) => Buffer.from(str).toString('hex');

async function main() {
  const shouldExecute = process.argv.includes('--execute');
  
  console.log('═'.repeat(70));
  console.log('🏷️  MULTIVERSX HEROTAG REGISTRATION');
  console.log('═'.repeat(70));
  console.log();
  
  // Check herotag availability
  console.log('📋 Checking herotag availability...');
  const checkResp = await fetch(`https://api.multiversx.com/usernames/${CONFIG.herotag}`, { redirect: 'manual' });
  if (checkResp.status !== 404) {
    console.log(`❌ Herotag "${CONFIG.herotag}" might be taken!`);
    process.exit(1);
  }
  console.log(`✅ Herotag "${CONFIG.herotag}" is AVAILABLE!`);
  
  // Load wallet
  console.log();
  console.log('🔐 Loading wallet...');
  const keyHex = fs.readFileSync(CONFIG.privateKeyPath, 'utf-8').trim();
  const secretKey = UserSecretKey.fromString(keyHex);
  const publicKey = secretKey.generatePublicKey();
  const senderAddress = publicKey.toAddress();
  
  console.log(`   Address: ${senderAddress.bech32()}`);
  
  // Connect to network
  const provider = new ProxyNetworkProvider(CONFIG.provider, { timeout: 20000 });
  const account = await provider.getAccount(senderAddress);
  
  const balance = Number(account.balance) / 1e18;
  console.log(`   Balance: ${balance.toFixed(4)} EGLD`);
  console.log(`   Nonce: ${account.nonce}`);
  
  // Build transaction
  console.log();
  console.log('📝 Building transaction...');
  
  const herotagHex = stringToHex(CONFIG.herotag);
  
  // The transaction data: setUsername@[herotag_hex]
  const payload = new TransactionPayload(`setUsername@${herotagHex}`);
  
  // Username contract
  const receiver = Address.fromBech32(CONFIG.usernameContract);
  
  const tx = new Transaction({
    nonce: account.nonce,
    sender: senderAddress,
    receiver: receiver,
    value: 0n,  // No EGLD needed, just gas
    gasLimit: CONFIG.gasLimit,
    chainID: CONFIG.chainId,
    data: payload,
  });
  
  console.log(`   Herotag: ${CONFIG.herotag} (PUBLIC)`);
  console.log(`   Gas: ${CONFIG.gasLimit}`);
  console.log(`   Data: setUsername@${herotagHex}`);
  console.log(`   Contract: ${CONFIG.usernameContract}`);
  
  if (!shouldExecute) {
    console.log();
    console.log('═'.repeat(70));
    console.log('📋 DRY RUN - Ready to send');
    console.log('═'.repeat(70));
    console.log();
    console.log('To execute: node register_herotag.mjs --execute');
    return;
  }
  
  // Sign
  console.log();
  console.log('🔐 Signing transaction...');
  
  const serialized = tx.serializeForSigning();
  const signature = secretKey.sign(serialized);
  tx.applySignature(signature);
  
  // Send
  console.log('📤 Sending to blockchain...');
  const txHash = await provider.sendTransaction(tx);
  
  console.log();
  console.log('═'.repeat(70));
  console.log('✅ HEROTAG REGISTRATION SENT!');
  console.log('═'.repeat(70));
  console.log();
  console.log(`🔗 Transaction: https://explorer.multiversx.com/transactions/${txHash}`);
  console.log(`🏷️  Herotag: ${CONFIG.herotag}`);
  console.log(`   Wallet: ${senderAddress.bech32()}`);
  console.log();
  console.log('⏳ Wait ~30 seconds for confirmation...');
  console.log();
  console.log('✅ After confirmation, your address will show as:');
  console.log(`   ${CONFIG.herotag}`);
  console.log(`   (${senderAddress.bech32()})`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});