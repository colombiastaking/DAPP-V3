import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useEffect, useState } from 'react';
import { decodeBigNumber, ContractFunction, Address, AddressValue } from '@multiversx/sdk-core';
import { createContractQuery } from 'helpers/contractQuery';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { Delegate } from 'components/Stake/components/Delegate';
import { Undelegate } from 'components/Stake/components/Undelegate';
import { ClaimEgldButton } from 'components/Stake/ClaimEgldButton';
import { Withdrawals } from 'components/Withdrawals';
import useStakeData from 'components/Stake/hooks';
import { useGlobalContext } from 'context';
import { useColsAprContext } from 'context/ColsAprContext';
import { usePreloadData } from 'hooks/usePreloadData';
import { network } from 'config';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './Delegation.module.scss';

const DELEGATION_CONTRACT = 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf';

export const Delegation = () => {
  const account = useGetAccount();
  const address = account.address;
  const { onRedelegate } = useStakeData();
  const { userClaimableRewards } = useGlobalContext();
  const { stakers } = useColsAprContext();
  
  // Preload all cached data at login
  usePreloadData();

  // Fetch delegated eGLD (same logic as Home.tsx)
  const [delegatedEgld, setDelegatedEgld] = useState<number>(0);
  const [loadingDelegated, setLoadingDelegated] = useState(true);

  useEffect(() => {
    if (!address) {
      setDelegatedEgld(0);
      setLoadingDelegated(false);
      return;
    }

    const fetchDelegatedEgld = async () => {
      setLoadingDelegated(true);
      try {
        // First try to get from stakers (COLS stakers data includes eGLD delegated)
        const userRow = stakers.find((s: any) => s.address === address);
        
        if (userRow && Number(userRow.colsStaked) > 0) {
          // User has COLS staked, use the eGLD from stakers data
          setDelegatedEgld(Number(userRow.egldStaked) || 0);
        } else {
          // No COLS staked, query the blockchain directly
          const provider = new ProxyNetworkProvider(network.gatewayAddress);
          const query = createContractQuery({
            address: new Address(DELEGATION_CONTRACT),
            func: new ContractFunction('getUserActiveStake'),
            args: [new AddressValue(new Address(address))]
          });
          const response = await provider.queryContract(query);
          const parts = response.getReturnDataParts();
          
          if (parts.length > 0) {
            const rawStake = decodeBigNumber(parts[0]).toFixed();
            setDelegatedEgld(Number(rawStake) / 1e18);
          } else {
            setDelegatedEgld(0);
          }
        }
      } catch (error) {
        console.error('Error fetching delegated eGLD:', error);
        setDelegatedEgld(0);
      }
      setLoadingDelegated(false);
    };

    fetchDelegatedEgld();
  }, [address, stakers]);

  // Get claimable rewards
  const claimableRewards = userClaimableRewards.status === 'loaded' 
    ? Number(userClaimableRewards.data || '0') 
    : 0;

  if (!address) {
    return (
      <div className={styles.delegation}>
        <div className={styles.noAddress}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div>Please connect your wallet to access delegation features.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.delegation}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroIcon}>💎</span>
          Delegate eGLD
        </h1>
        <p className={styles.heroSubtitle}>
          Stake your eGLD with Colombia Staking and earn rewards
        </p>
      </section>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statLabel}>Delegated</div>
          <div className={styles.statValue}>
            {loadingDelegated ? (
              <AnimatedDots />
            ) : (
              <>{delegatedEgld.toFixed(4)} eGLD</>
            )}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🎁</div>
          <div className={styles.statLabel}>Claimable</div>
          <div className={`${styles.statValue} ${styles.statValueAccent}`}>
            {claimableRewards.toFixed(4)} eGLD
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <section className={styles.actionsSection}>
        <h3 className={styles.actionsTitle}>Actions</h3>
        <div className={styles.actionsGrid}>
          {/* Delegate */}
          <Delegate />

          {/* Claim Rewards */}
          <ClaimEgldButton onClaimed={() => {}} />

          {/* Redelegate */}
          <button
            type="button"
            className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
            onClick={onRedelegate(() => {})}
          >
            <span className={styles.actionIcon}>🔄</span>
            <span className={styles.actionLabel}>Redelegate</span>
          </button>

          {/* Undelegate */}
          <Undelegate />
        </div>
      </section>

      {/* Pending Withdrawals */}
      <div className={styles.withdrawalsSection}>
        <Withdrawals />
      </div>
    </div>
  );
};

export default Delegation;