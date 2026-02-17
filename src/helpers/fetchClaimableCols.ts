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
 * The contract returns EarnerInfo struct with:
 * - entity: Address
 * - entity_info: EntityInfo (nested struct)
 * - stake_amount: BigUint
 * - stake_locked_until: u64
 * - reward_amount: BigUint
 * 
 * We only need reward_amount and stake_locked_until
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
      return { claimable: "0", lockTime: 0 };
    }

    // The response is a single nested struct encoded as one buffer
    // We need to decode it to extract reward_amount and stake_locked_until
    // Struct layout (simplified):
    // - entity (32 bytes)
    // - entity_info (nested struct with 7 fields, variable length)
    // - stake_amount (BigUint, variable length - encoded as 4 byte length + bytes)
    // - stake_locked_until (8 bytes u64)
    // - reward_amount (BigUint, variable length)

    // For simplicity, let's try to decode assuming standard format
    // Actually, let's just use the raw return data and decode manually
    
    // The struct is returned as top-encoded data
    // For nested structs, we need to decode carefully
    // The easiest approach is to look at the full response structure
    
    // Alternative: Use BigUint decoding for the reward amount
    // The last BigUint in the struct should be reward_amount
    
    const fullData = returnData[0];
    if (!fullData || fullData.length === 0) {
      return { claimable: "0", lockTime: 0 };
    }

    // The structure from the contract:
    // EarnerInfo contains 5 fields where the last 2 are BigUint values
    // stake_locked_until (u64, 8 bytes) comes before reward_amount (BigUint)
    // We need to find the proper offsets

    // For a simple approach, let's decode assuming the standard layout:
    // The struct is: entity (32) + entity_info (variable) + stake_amount (4+len) + stake_locked_until (8) + reward_amount (4+len)
    
    // Since this is complex, let's try a simpler approach - look at the raw data
    // and extract the BigUint values from the end

    let offset = 0;
    
    // Skip entity (32 bytes for Address)
    offset += 32;
    
    // Skip entity_info - this is a nested struct
    // EntityInfo has: stake_token (Option<TokenIdentifier> = 1+8+variable), 
    // reward_token (EgldOrEsdtTokenIdentifier = 1+variable),
    // lock_time_seconds (u64 = 8), last_reward_at (u64 = 8),
    // last_reward_amount (BigUint = 4+len), total_reward_amount (BigUint = 4+len),
    // paused (bool = 1)
    // This is complex, so let's use a heuristic
    
    // Actually, the simplest approach is to decode from the end
    // reward_amount is the last field (BigUint) and stake_locked_until is second to last (u64, 8 bytes)
    
    // Read from end: last 4 bytes are length of reward_amount, then the bytes
    if (fullData.length < 8) {
      return { claimable: "0", lockTime: 0 };
    }
    
    // Read BigUint length from the last 4 bytes
    const rewardAmountLen = fullData.readUInt32BE(fullData.length - 4);
    
    // The reward_amount bytes are before that
    if (rewardAmountLen > 0 && fullData.length >= 4 + rewardAmountLen) {
      const rewardAmountBytes = fullData.slice(
        fullData.length - 4 - rewardAmountLen,
        fullData.length - 4
      );
      const rewardAmount = bytesToBigInt(rewardAmountBytes);
      
      // Before reward_amount is stake_locked_until (8 bytes u64)
      const lockTimeOffset = fullData.length - 4 - rewardAmountLen - 8;
      if (lockTimeOffset >= 0) {
        const lockTime = fullData.readBigUInt64BE(lockTimeOffset);
        return { 
          claimable: rewardAmount.toString(), 
          lockTime: Number(lockTime) 
        };
      }
    }

    return { claimable: "0", lockTime: 0 };
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