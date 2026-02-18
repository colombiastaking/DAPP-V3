import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { Delegate } from 'components/Stake/components/Delegate';
import { Undelegate } from 'components/Stake/components/Undelegate';
import { ClaimEgldButton } from 'components/Stake/ClaimEgldButton';
import { Withdrawals } from 'components/Withdrawals';
import useStakeData from 'components/Stake/hooks';
import { useGlobalContext } from 'context';
import { useColsAprContext } from 'context/ColsAprContext';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './Delegation.module.scss';

export const Delegation = () => {
  const account = useGetAccount();
  const address = account.address;
  const { onRedelegate } = useStakeData();
  const { userClaimableRewards, userActiveStake } = useGlobalContext();
  const { stakers, baseApr } = useColsAprContext();

  // Get delegated eGLD from context (fallback to stakers data if user has COLS staked)
  const userRow = stakers.find((s: any) => s.address === address);
  const delegatedEgldFromStakers = userRow?.egldStaked ? Number(userRow.egldStaked) : 0;
  
  // Use userActiveStake from context, or fallback to stakers data for COLS stakers
  const delegatedEgld = userActiveStake.status === 'loaded' 
    ? Number(userActiveStake.data || '0') / 1e18 
    : delegatedEgldFromStakers;

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

      {/* Why Delegate Here - Strengths */}
      <div className={styles.strengthsGrid}>
        <div className={styles.strengthCard}>
          <div className={styles.strengthIcon}>🛡️</div>
          <div className={styles.strengthTitle}>48 Nodes</div>
          <div className={styles.strengthDesc}>Most secure agency</div>
        </div>
        <div className={styles.strengthCard}>
          <div className={styles.strengthIcon}>🇨🇴</div>
          <div className={styles.strengthTitle}>Colombian</div>
          <div className={styles.strengthDesc}>Unique positioning</div>
        </div>
        <div className={styles.strengthCard}>
          <div className={styles.strengthIcon}>📈</div>
          <div className={styles.strengthTitle}>Base {baseApr.toFixed(1)}%</div>
          <div className={styles.strengthDesc}>+ up to 15% COLS bonus</div>
        </div>
        <div className={styles.strengthCard}>
          <div className={styles.strengthIcon}>⚡</div>
          <div className={styles.strengthTitle}>Fast</div>
          <div className={styles.strengthDesc}>Quick rewards</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statLabel}>Delegated</div>
          <div className={styles.statValue}>
            {userActiveStake.status === 'loading' ? (
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
            {userClaimableRewards.status === 'loading' ? <AnimatedDots /> : <>{claimableRewards.toFixed(4)} eGLD</>}
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