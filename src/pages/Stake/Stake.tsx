import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { ClaimColsButton } from 'components/Stake/ClaimColsButton';
import { StakeCols } from 'components/Stake/components/StakeCols';
import { BuyCols } from 'components/Stake/components/BuyCols';
import { useGlobalContext } from 'context';
import { useColsAprContext } from 'context/ColsAprContext';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './styles.module.scss';

export const Stake = () => {
  const account = useGetAccount();
  const address = account.address;
  const { claimableCols, colsBalance } = useGlobalContext();
  const { stakers, baseApr, aprMax } = useColsAprContext();

  // Get COLS staked from stakers context
  const userRow = stakers.find((s: any) => s.address === address);
  const colsStaked = userRow?.colsStaked ? Number(userRow.colsStaked) : 0;

  // Get claimable COLS (raw value needs to be divided by 1e18)
  const claimableColsRaw = claimableCols.status === 'loaded' 
    ? claimableCols.data 
    : null;
  const claimableColsValue = claimableColsRaw 
    ? Number(claimableColsRaw) / 1e18 
    : 0;

  // Get COLS balance from context
  const colsBalanceValue = colsBalance.status === 'loaded' 
    ? colsBalance.data 
    : '0';

  // Check user state for conditional messaging
  const hasNoCols = Number(colsBalanceValue) === 0 && colsStaked === 0;
  const hasLittleCols = Number(colsBalanceValue) > 0 && Number(colsBalanceValue) < 100;

  if (!address) {
    return (
      <div className={styles.stake}>
        <div className={styles.noAddress}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div>Please connect your wallet to stake COLS.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stake}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroIcon}>🔥</span>
          Stake COLS
        </h1>
        <p className={styles.heroSubtitle}>
          Stake your COLS tokens to earn additional APR bonus
        </p>
      </section>

      {/* Empty State - No COLS at all */}
      {hasNoCols && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>💎</div>
          <h3 className={styles.emptyTitle}>Start Earning Bonus APR!</h3>
          <p className={styles.emptyText}>
            Stake COLS tokens to boost your rewards. Your bonus APR scales from <strong>0.5% to +{aprMax}%</strong> based on your COLS/eGLD ratio.
          </p>
          <div className={styles.emptyBenefits}>
            <div className={styles.emptyBenefit}>🚀 {baseApr.toFixed(1)}% base + up to +{aprMax}% bonus</div>
            <div className={styles.emptyBenefit}>🏆 Climb the league leaderboard</div>
            <div className={styles.emptyBenefit}>💰 Maximize your staking returns</div>
          </div>
        </div>
      )}

      {/* Has COLS but small amount */}
      {hasLittleCols && (
        <div className={styles.upsellState}>
          <div className={styles.upsellIcon}>💪</div>
          <h3 className={styles.upsellTitle}>Level Up!</h3>
          <p className={styles.upsellText}>
            You're on your way! Stake more COLS to unlock higher leagues and earn even more bonus APR.
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🪙</div>
          <div className={styles.statLabel}>COLS Staked</div>
          <div className={styles.statValue}>
            {stakers.length === 0 ? <AnimatedDots /> : colsStaked.toFixed(4)}
          </div>
          <div className={styles.statHint}>Currently staked</div>
        </div>
        <div className={styles.statCardAccent}>
          <div className={styles.statIcon}>🎁</div>
          <div className={styles.statLabel}>Claimable</div>
          <div className={`${styles.statValue} ${styles.statValueAccent}`}>
            {claimableCols.status === 'loading' ? <AnimatedDots /> : claimableColsValue.toFixed(4)}
          </div>
          <div className={styles.statHint}>Rewards ready</div>
        </div>
      </div>

      {/* Wallet Balance Card */}
      <div className={styles.statCard} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className={styles.statLabel}>Wallet Balance</div>
            <div className={styles.statValue}>
              {colsBalance.status === 'loading' ? <AnimatedDots /> : `${Number(colsBalanceValue).toFixed(4)} COLS`}
            </div>
          </div>
          <div style={{ fontSize: 32 }}>💼</div>
        </div>
      </div>

      {/* Actions Section */}
      <section className={styles.actionsSection}>
        <h3 className={styles.actionsTitle}>Actions</h3>
        <div className={styles.actionsGrid}>
          {/* Stake COLS */}
          <StakeCols />

          {/* Claim COLS */}
          <ClaimColsButton onClaimed={() => {}} />
        </div>
      </section>

      {/* Buy COLS Section */}
      <BuyCols />
    </div>
  );
};

export default Stake;