import { useEffect, useState } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { ClaimColsButton } from 'components/Stake/ClaimColsButton';
import { StakeCols } from 'components/Stake/components/StakeCols';
import { BuyCols } from 'components/Stake/components/BuyCols';
import { useGlobalContext } from 'context';
import { useColsAprContext } from 'context/ColsAprContext';
import axios from 'axios';
import { network } from 'config';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './styles.module.scss';

const COLS_TOKEN_ID = 'COLS-9d91b7';

function denominateCols(raw: string) {
  if (!raw || raw === '0') return '0';
  let str = raw.padStart(19, '0');
  const intPart = str.slice(0, -18) || '0';
  let decPart = str.slice(-18).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

export const Stake = () => {
  const account = useGetAccount();
  const address = account.address;
  const { claimableCols } = useGlobalContext();
  const { stakers } = useColsAprContext();
  
  const [colsBalance, setColsBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);

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

  // Fetch COLS wallet balance
  useEffect(() => {
    const fetchColsBalance = async () => {
      if (!address) {
        setColsBalance('0');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${network.apiAddress}/accounts/${address}/tokens?identifier=${COLS_TOKEN_ID}`
        );
        if (Array.isArray(data) && data.length > 0 && data[0].identifier === COLS_TOKEN_ID) {
          setColsBalance(denominateCols(data[0].balance));
        } else {
          setColsBalance('0');
        }
      } catch {
        setColsBalance('0');
      }
      setLoading(false);
    };

    fetchColsBalance();
  }, [address]);

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

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🪙</div>
          <div className={styles.statLabel}>COLS Staked</div>
          <div className={styles.statValue}>
            {loading ? <AnimatedDots /> : colsStaked.toFixed(4)}
          </div>
          <div className={styles.statHint}>Currently staked</div>
        </div>
        <div className={styles.statCardAccent}>
          <div className={styles.statIcon}>🎁</div>
          <div className={styles.statLabel}>Claimable</div>
          <div className={`${styles.statValue} ${styles.statValueAccent}`}>
            {claimableColsValue.toFixed(4)}
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
              {loading ? <AnimatedDots /> : Number(colsBalance).toFixed(4)} COLS
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