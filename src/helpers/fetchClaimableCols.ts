import {
  Address,
  ContractFunction,
  AddressValue
} from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { createContractQuery } from 'helpers/contractQuery';

// Cache for fetch results - prevents re-fetching on tab switches
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

function getCacheKey(contract: string, user: string): string {
  return `${contract}:${user}`;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Fetches claimable COLS and lock time from the PeerMe contract
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
  // Check cache first
  const cacheKey = getCacheKey(contract, user);
  const cached = getCached<{ claimable: string; lockTime: number }>(cacheKey);
  if (cached) {
    return cached;
  }

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

    // Parse the EarnerInfo struct
    let offset = 0;

    // Skip entity address (32 bytes)
    offset += 32;

    // Skip EntityInfo struct
    // stake_token: Option<TokenIdentifier> (1 byte flag + optional value)
    const stakeTokenFlag = data[offset];
    offset += 1;
    if (stakeTokenFlag === 1) {
      const stakeTokenLen = readUInt32BE(data, offset);
      offset += 4 + stakeTokenLen;
    }

    // reward_token: TokenIdentifier (4 byte len + bytes)
    const rewardTokenLen = readUInt32BE(data, offset);
    offset += 4 + rewardTokenLen;

    // lock_time_seconds: u64
    offset += 8;

    // last_reward_at: u64
    offset += 8;

    // last_reward_amount: BigUint
    const lastRewardLen = readUInt32BE(data, offset);
    offset += 4 + lastRewardLen;

    // total_reward_amount: BigUint
    const totalRewardLen = readUInt32BE(data, offset);
    offset += 4 + totalRewardLen;

    // paused: bool
    offset += 1;

    // Now we're at EarnerInfo fields (after EntityInfo)
    // stake_amount: BigUint
    const stakeAmountLen = readUInt32BE(data, offset);
    offset += 4 + stakeAmountLen;

    // stake_locked_until: u64 (THE LOCK TIME!) - read manually for browser compatibility
    const stakeLockedUntil = readUInt64BE(data, offset);
    offset += 8;

    // reward_amount: BigUint (THE CLAIMABLE COLS!)
    const rewardAmountLen = readUInt32BE(data, offset);
    offset += 4;
    
    let claimable = "0";
    if (rewardAmountLen > 0 && offset + rewardAmountLen <= data.length) {
      const rewardAmountBytes = data.slice(offset, offset + rewardAmountLen);
      claimable = bytesToBigInt(rewardAmountBytes).toString();
    }

    console.log("Parsed claimable:", claimable, "lockTime:", stakeLockedUntil);

    const result = { 
      claimable, 
      lockTime: stakeLockedUntil 
    };
    
    // Cache the result
    setCache(cacheKey, result);
    
    return result;
  } catch (error) {
    console.error("Error fetching claimable COLS:", error);
    return { claimable: "0", lockTime: 0 };
  }
}

/**
 * Read 32-bit unsigned integer from buffer (big-endian) - browser compatible
 */
function readUInt32BE(buffer: Buffer, offset: number): number {
  return (
    (buffer[offset] << 24) |
    (buffer[offset + 1] << 16) |
    (buffer[offset + 2] << 8) |
    buffer[offset + 3]
  ) >>> 0;
}

/**
 * Read 64-bit unsigned integer from buffer (big-endian) - browser compatible
 */
function readUInt64BE(buffer: Buffer, offset: number): number {
  const high = readUInt32BE(buffer, offset);
  const low = readUInt32BE(buffer, offset + 4);
  // For timestamps, we should be safe with Number (up to ~281 trillion)
  return high * 4294967296 + low;
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