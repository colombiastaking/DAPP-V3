/**
 * DAO Pool Distribution Script - FIXED
 * 
 * Uses PeerMe smart contract distribute() function
 * The contract automatically distributes to ALL COLS stakers based on their stake
 * 
 * Transaction format:
 *   ESDTTransfer@COLS_HEX@AMOUNT_HEX@distribute@ENTITY_HEX
 * 
 * Run with: node execute_dao_distribution_v2.cjs
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
  const CHAIN_ID = "1";          // Mainnet
  const GAS_LIMIT = 10000000;    // Higher gas for smart contract call

  // Contract addresses
  const PEERME_CLAIM_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";
  const PEERME_ENTITY = "erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0";

  console.log("═".repeat(70));
  console.log("🏛️ DAO POOL DISTRIBUTION v2 (SMART CONTRACT METHOD)");
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
  
  // Load DAO amount from distribution file
  const recipientsData = JSON.parse(fs.readFileSync('/tmp/distribution_full_v4.json', 'utf-8'));
  const daoRecipients = recipientsData.daoRecipients || [];
  const daoAmount = daoRecipients.reduce((s, r) => s + (r.dailyDao || 0), 0);
  
  console.log("═".repeat(70));
  console.log("DAO POOL CONFIGURATION");
  console.log("═".repeat(70));
  console.log(`DAO Amount: ${daoAmount.toFixed(6)} COLS`);
  console.log(`DAO Recipients (for info): ${daoRecipients.length} (contract distributes to all COLS stakers)`);
  console.log();
  console.log(`Claim Contract: ${PEERME_CLAIM_CONTRACT}`);
  console.log(`Entity Address: ${PEERME_ENTITY}`);
  console.log();

  // Helper: Convert amount to properly padded hex string
  function amountToHex(amountCols) {
    const amountBigInt = BigInt(Math.floor(amountCols * 1e18));
    let hexStr = amountBigInt.toString(16);
    
    // Pad with leading zero if length is odd
    if (hexStr.length % 2 !== 0) {
      hexStr = '0' + hexStr;
    }
    
    return hexStr;
  }

  // Helper: Convert bech32 address to padded hex (32 bytes)
  function addressToPaddedHex(bech32Address) {
    const addr = new Address(bech32Address);
    const hexBytes = addr.hex();
    // Already 32 bytes (64 hex chars) from Address.hex()
    return hexBytes;
  }

  // Verify sufficient balance
  if (Number(colsBalance) < daoAmount * 1e18) {
    throw new Error(`Insufficient COLS balance. Need ${daoAmount.toFixed(2)}, have ${Number(colsBalance)/1e18}`);
  }
  
  // Build smart contract call data
  const tokenHex = Buffer.from(COLS_TOKEN_ID).toString('hex');
  const amountHex = amountToHex(daoAmount);
  const distributeHex = Buffer.from('distribute').toString('hex');
  const entityHex = addressToPaddedHex(PEERME_ENTITY);
  
  // Data format: ESDTTransfer@TOKEN@AMOUNT@distribute@ENTITY
  const dataStr = `ESDTTransfer@${tokenHex}@${amountHex}@${distributeHex}@${entityHex}`;
  
  console.log("═".repeat(70));
  console.log("TRANSACTION DATA");
  console.log("═".repeat(70));
  console.log(`Data: ${dataStr}`);
  console.log();
  console.log("Parsed:");
  console.log(`  [0] ESDTTransfer`);
  console.log(`  [1] Token: ${COLS_TOKEN_ID} (hex: ${tokenHex})`);
  console.log(`  [2] Amount: ${daoAmount.toFixed(6)} COLS (hex: ${amountHex})`);
  console.log(`  [3] Function: distribute (hex: ${distributeHex})`);
  console.log(`  [4] Entity: ${PEERME_ENTITY} (hex: ${entityHex})`);
  console.log();

  // Check for execute flag
  const shouldExecute = process.argv.includes('--execute');
  
  if (!shouldExecute) {
    console.log("═".repeat(70));
    console.log("📋 DRY RUN - Transaction preview");
    console.log("═".repeat(70));
    console.log();
    console.log("Transaction would be sent:");
    console.log(`  From: ${senderAddress.bech32()}`);
    console.log(`  To: ${PEERME_CLAIM_CONTRACT} (PeerMe Claim Contract)`);
    console.log(`  Amount: ${daoAmount.toFixed(6)} COLS`);
    console.log(`  Gas Limit: ${GAS_LIMIT}`);
    console.log(`  Gas Cost: ~${(GAS_LIMIT * 0.001).toFixed(3)} EGLD (estimate)`);
    console.log();
    console.log("The contract will automatically distribute to ALL COLS stakers!");
    console.log();
    console.log("To execute, run with --execute flag");
    return;
  }
  
  // EXECUTE MODE
  console.log("═".repeat(70));
  console.log("⚠️  EXECUTE MODE - Transaction will be sent!");
  console.log("═".repeat(70));
  console.log();
  
  const payload = new TransactionPayload(dataStr);
  
  const tx = new Transaction({
    sender: senderAddress,
    receiver: new Address(PEERME_CLAIM_CONTRACT),
    value: 0n,
    gasLimit: GAS_LIMIT,
    chainID: CHAIN_ID,
    nonce: accountOnNetwork.nonce,
    data: payload
  });
  
  // Sign transaction
  const serializedTx = tx.serializeForSigning();
  const signature = secretKey.sign(serializedTx);
  tx.applySignature(signature);
  
  // Broadcast
  try {
    const txHash = await provider.sendTransaction(tx);
    console.log(`✅ Transaction sent: ${txHash}`);
    console.log();
    console.log(`Explorer: https://explorer.multiversx.com/transactions/${txHash}`);
    
    fs.writeFileSync('/tmp/dao_distribution_results_v2.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      txHash: txHash.toString(),
      amount: daoAmount,
      contract: PEERME_CLAIM_CONTRACT,
      entity: PEERME_ENTITY,
      status: "sent"
    }, null, 2));
    
    console.log(`\n✅ Results saved to /tmp/dao_distribution_results_v2.json`);
  } catch (e) {
    console.error(`❌ Error: ${e.message}`);
    throw e;
  }
}

main().catch(console.error);