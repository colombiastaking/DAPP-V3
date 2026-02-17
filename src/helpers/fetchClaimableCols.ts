import {
  Address,
  ContractFunction,
  AddressValue
} from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { createContractQuery } from 'helpers/contractQuery';

/**
 * Fetches claimable COLS and lock time from the PeerMe contract
 * 
 * Contract returns EarnerInfo struct (manually parsed):
 * - entity: Address (32 bytes)
 * - entity_info: EntityInfo (nested struct)
 *   - stake_token: Option<TokenIdentifier> (1 byte flag + optional 4 byte len + bytes)
 *   - reward_token: TokenIdentifier (4 byte len + bytes)
 *   - lock_time_seconds: u64 (8 bytes)
 *   - last_reward_at: u64 (8 bytes)
 *   - last_reward_amount: BigUint (4 byte len + bytes)
 *   - total_reward_amount: BigUint (4 byte len + bytes)
 *   - paused: bool (1 byte)
 * - stake_amount: BigUint (4 byte len + bytes)
 * - stake_locked_until: u64 (8 bytes)
 * - reward_amount: BigUint (4 byte len + bytes) <- THIS IS THE CLAIMABLE COLS
 */
export async function fetchClaimableColsAndLockTime({
  contract,
  entity,
  user,
  providerUrl
}: {
  contract: string;
  entity: string;
  user: string;
  providerUrl: string;
}): Promise<{ claimable: string; lockTime: number }> {
  try {
    const provider = new ProxyNetworkProvider(providerUrl);
    const query = createContractQuery({
      address: new Address(contract),
      func: new ContractFunction("getEarnerInfo"),
      args: [
        new AddressValue(new Address(entity)),
        new AddressValue(new Address(user))
      ]
    });

    const response = await provider.queryContract(query);
    const returnData = response.getReturnDataParts();

    if (!returnData || returnData.length === 0) {
      console.log("No return data from getEarnerInfo");
      return { claimable: "0", lockTime: 0 };
    }

    const data = returnData[0];
    if (!data || data.length === 0) {
      console.log("Empty data buffer from getEarnerInfo");
      return { claimable: "0", lockTime: 0 };
    }

    console.log("Raw response length:", data.length, "bytes");

    // Parse the EarnerInfo struct
    let offset = 0;

    // Skip entity address (32 bytes)
    offset += 32;

    // Skip EntityInfo struct
    // stake_token: Option<TokenIdentifier> (1 byte flag + optional value)
    const stakeTokenFlag = data[offset];
    offset += 1;
    if (stakeTokenFlag === 1) {
      // Some: read length + bytes
      const stakeTokenLen = data.readUInt32BE(offset);
      offset += 4 + stakeTokenLen;
    }

    // reward_token: TokenIdentifier (4 byte len + bytes)
    const rewardTokenLen = data.readUInt32BE(offset);
    offset += 4 + rewardTokenLen;

    // lock_time_seconds: u64
    offset += 8;

    // last_reward_at: u64
    offset += 8;

    // last_reward_amount: BigUint
    const lastRewardLen = data.readUInt32BE(offset);
    offset += 4 + lastRewardLen;

    // total_reward_amount: BigUint
    const totalRewardLen = data.readUInt32BE(offset);
    offset += 4 + totalRewardLen;

    // paused: bool
    offset += 1;

    // Now we're at EarnerInfo fields (after EntityInfo)
    // stake_amount: BigUint
    const stakeAmountLen = data.readUInt32BE(offset);
    offset += 4 + stakeAmountLen;

    // stake_locked_until: u64 (THE LOCK TIME!)
    const stakeLockedUntil = Number(data.readBigUInt64BE(offset));
    offset += 8;

    // reward_amount: BigUint (THE CLAIMABLE COLS!)
    const rewardAmountLen = data.readUInt32BE(offset);
    offset += 4;
    
    let claimable = "0";
    if (rewardAmountLen > 0 && offset + rewardAmountLen <= data.length) {
      const rewardAmountBytes = data.slice(offset, offset + rewardAmountLen);
      claimable = bytesToBigInt(rewardAmountBytes).toString();
    }

    console.log("Parsed claimable:", claimable, "lockTime:", stakeLockedUntil);

    return { 
      claimable, 
      lockTime: stakeLockedUntil 
    };
  } catch (error) {
    console.error("Error fetching claimable COLS:", error);
    return { claimable: "0", lockTime: 0 };
  }
}

/**
 * Convert bytes to BigInt (big-endian)
 */
function bytesToBigInt(bytes: Buffer): bigint {
  let result = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    result = result * BigInt(256) + BigInt(bytes[i]);
  }
  return result;
}

export default fetchClaimableColsAndLockTime;