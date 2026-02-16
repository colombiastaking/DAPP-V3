import walletPkg from "@multiversx/sdk-wallet";
const { UserSecretKey, UserSigner } = walletPkg;
import * as fs from "fs";

const keyHex = fs.readFileSync('/home/raspberry/.openclaw/wallet/.private_key', 'utf-8').trim();
console.log("Key length:", keyHex.length);

try {
  // Create secret key from hex buffer
  const secretKey = UserSecretKey.fromString(keyHex);
  console.log("SecretKey created successfully");
  
  // Create signer
  const signer = new UserSigner(secretKey);
  console.log("Address:", signer.getAddress().bech32());
} catch (e) {
  console.log("Error:", e.message);
  console.log(e.stack);
}
