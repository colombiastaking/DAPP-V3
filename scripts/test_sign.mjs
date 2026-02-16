import corePkg from "@multiversx/sdk-core";
const { Transaction, Address, TransactionPayload } = corePkg;
import walletPkg from "@multiversx/sdk-wallet";
const { UserSecretKey } = walletPkg;
import { ProxyNetworkProvider } from "@multiversx/sdk-network-providers";
import * as fs from "fs";

const provider = new ProxyNetworkProvider("https://gateway.multiversx.com");
const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
const secretKey = UserSecretKey.fromString(keyHex);
const senderAddress = secretKey.generatePublicKey().toAddress();

console.log("Address:", senderAddress.bech32());

// Get account for nonce
const accountOnNetwork = await provider.getAccount(senderAddress);
console.log("Nonce:", accountOnNetwork.nonce);

// Create a COLS transfer transaction (minimal test)
const COLS_TOKEN_ID = "COLS-9d91b7";
const tokenIdHex = Buffer.from(COLS_TOKEN_ID).toString('hex');
const amountHex = BigInt(1).toString(16).padStart(16, '0');
const dataStr = `ESDTTransfer@${tokenIdHex}@${amountHex}`;
console.log("Data:", dataStr);

const tx = new Transaction({
  sender: senderAddress,
  receiver: senderAddress, // send to self for test
  value: 0n,
  gasLimit: 600000,
  chainID: "1",
  nonce: accountOnNetwork.nonce,
  data: new TransactionPayload(Buffer.from(dataStr))
});

// Serialize for signing
const serialized = tx.serializeForSigning();
console.log("Serialized length:", serialized.length);

// Sign
const signature = secretKey.sign(serialized);
console.log("Signature length:", signature.length);

// Apply signature
tx.applySignature(signature);

console.log("Signature applied!");

// Broadcast
console.log("\nBroadcasting test transaction (sending 0.000000000000000001 COLS to self)...");
try {
  const hash = await provider.sendTransaction(tx);
  console.log("\n✅ TX Hash:", hash);
  console.log("Explorer:", `https://explorer.multiversx.com/transactions/${hash}`);
} catch (e) {
  console.log("Error:", e.message);
}
