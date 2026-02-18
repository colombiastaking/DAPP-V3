import { useState, useEffect } from 'react';

const GOLD_COLLECTION = 'COL-70965c';
const GOLD_EGLD_CAPACITY_PER_NFT = 500;

interface GoldMemberInfo {
  isGoldMember: boolean;
  goldNftCount: number;
  goldCapacityEgld: number;
}

export const useGoldMember = (address: string | undefined) => {
  const [goldInfo, setGoldInfo] = useState<GoldMemberInfo>({
    isGoldMember: false,
    goldNftCount: 0,
    goldCapacityEgld: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setGoldInfo({ isGoldMember: false, goldNftCount: 0, goldCapacityEgld: 0 });
      return;
    }

    const fetchGoldStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://api.multiversx.com/accounts/${address}/nfts?collection=${GOLD_COLLECTION}&limit=100`
        );
        if (response.ok) {
          const nfts = await response.json();
          const nftCount = Array.isArray(nfts) ? nfts.length : 0;
          setGoldInfo({
            isGoldMember: nftCount > 0,
            goldNftCount: nftCount,
            goldCapacityEgld: nftCount * GOLD_EGLD_CAPACITY_PER_NFT
          });
        }
      } catch (error) {
        console.error('Error fetching Gold member status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGoldStatus();
  }, [address]);

  return { ...goldInfo, isLoading };
};

// Calculate Gold member APR bonus
// Formula: GoldBonus = rawBaseApr * serviceFee * min(1, goldCapacity / userEgld)
// - rawBaseApr = baseApr / (1 - serviceFee) = baseApr / 0.9 (APR before fee)
// - If user has ≤ goldCapacity: full bonus = rawBaseApr * serviceFee
// - If user has > goldCapacity: prorated bonus
export const calculateGoldBonusApr = (
  baseApr: number,  // APR with fee already deducted (e.g., 8.41%)
  userEgldStaked: number,
  goldCapacityEgld: number,
  serviceFee: number = 0.10
): number => {
  if (userEgldStaked <= 0 || goldCapacityEgld <= 0) return 0;
  
  // Calculate raw APR before service fee: baseApr / (1 - fee)
  const rawBaseApr = baseApr / (1 - serviceFee);
  const fullBonus = rawBaseApr * serviceFee;
  const ratio = Math.min(1, goldCapacityEgld / userEgldStaked);
  
  return fullBonus * ratio;
};

// Get raw APR without service fee
export const getRawApr = (baseApr: number, serviceFee: number = 0.10): number => {
  return baseApr / (1 - serviceFee);
};

// Calculate effective APR for user with Gold membership
// Gold member gets: regular APR (base * 0.9) + gold bonus
// The bonus is: baseApr * serviceFee * min(1, goldCapacity/userEgld)
export const calculateEffectiveApr = (
  baseApr: number,
  userEgldStaked: number,
  goldCapacityEgld: number,
  serviceFee: number = 0.10
): {
  effectiveApr: number;
  goldBonusApr: number;
  regularApr: number;
  isGoldMember: boolean;
  goldEligibleEgld: number;
  regularEligibleEgld: number;
} => {
  const regularApr = baseApr * (1 - serviceFee);
  
  if (goldCapacityEgld <= 0 || userEgldStaked <= 0) {
    return {
      effectiveApr: regularApr,
      goldBonusApr: 0,
      regularApr,
      isGoldMember: false,
      goldEligibleEgld: 0,
      regularEligibleEgld: userEgldStaked
    };
  }
  
  const goldBonusApr = calculateGoldBonusApr(baseApr, userEgldStaked, goldCapacityEgld, serviceFee);
  const effectiveApr = regularApr + goldBonusApr;
  const goldEligibleEgld = Math.min(userEgldStaked, goldCapacityEgld);
  const regularEligibleEgld = Math.max(0, userEgldStaked - goldCapacityEgld);
  
  return {
    effectiveApr,
    goldBonusApr,
    regularApr,
    isGoldMember: true,
    goldEligibleEgld,
    regularEligibleEgld
  };
};
