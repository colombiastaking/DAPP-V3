import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { Delegate } from 'components/Stake/components/Delegate';
import { Undelegate } from 'components/Stake/components/Undelegate';
import { ClaimEgldButton } from 'components/Stake/ClaimEgldButton';
import { Withdrawals } from 'components/Withdrawals';
import useStakeData from 'components/Stake/hooks';
import { useGlobalContext } from 'context';
import styles from './Delegation.module.scss';

export const Delegation = () => {
  const { address } = useGetAccountInfo();
  const { onRedelegate } = useStakeData();
  const { userActiveStake, userClaimableRewards } = useGlobalContext();

  // Get delegated eGLD
  const delegatedRaw = userActiveStake.data || '0';
  const delegatedEgld = Number(delegatedRaw) / 1e18;

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
            {delegatedEgld.toFixed(4)} eGLD
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