import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { RankingTable } from 'components/Stake/RankingTable';
import { useColsAprContext } from '../../context/ColsAprContext';
import styles from './styles.module.scss';
import { AnimatedDots } from 'components/AnimatedDots';
import { HelpIcon } from 'components/HelpIcon';
import { ColsAprTable } from 'components/ColsAprTable';
import { useEffect } from 'react';
import { onTxCompleted } from 'utils/txEvents';

export const Home = () => {
  const { address } = useGetAccountInfo();
  const { stakers, loading, egldPrice, colsPrice, baseApr, refresh } = useColsAprContext();

  // Refresh on transaction completed event to ensure UI updates
  useEffect(() => {
    const unsubscribe = onTxCompleted(() => {
      refresh();
    });
    return unsubscribe;
  }, [refresh]);

  if (!address) {
    return null;
  }

  const userRow = address && Array.isArray(stakers)
    ? stakers.find((s: any) => s.address === address)
    : null;

  const egldDelegated = userRow?.egldStaked ?? 0;
  const colsStaked = userRow?.colsStaked ?? 0;
  const aprTotal = userRow?.aprTotal ?? null;
  const rank = userRow?.rank ?? null;

  const totalUsd =
    (Number(egldDelegated) * Number(egldPrice || 0)) +
    (Number(colsStaked) * Number(colsPrice || 0));

  const totalStakers = stakers.length;

  // Blue color for Total APR emphasis (same as user rank badge)
  const aprColor = '#1976d2';

  // Help text for Total APR clarifying eGLD vs COLS basis
  const totalAprHelpText = `Total APR represents your annual percentage rate based on your staking status:
- If you have eGLD delegated, the Total APR applies to your eGLD delegation.
- If you have no eGLD delegated, the Total APR applies to your COLS token stake.
This ensures the APR reflects your actual staking position.`;

  return (
    <div className={styles.landing}>
      <section className={styles.assetGrid}>
        <div className={styles.assetCard}>
          <div className={styles.assetLabel}>eGLD Delegated</div>
          <div className={styles.assetValue}>
            {egldDelegated ? Number(egldDelegated).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'} EGLD
          </div>
          <div className={styles.assetUsd}>
            ≈ ${Math.floor(Number(egldDelegated) * Number(egldPrice || 0))}
          </div>
        </div>

        <div className={styles.assetCard}>
          <div className={styles.assetLabel}>COLS Staked</div>
          <div className={styles.assetValue}>
            {colsStaked ? Number(colsStaked).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'} COLS
          </div>
          <div className={styles.assetUsd}>
            ≈ ${(Number(colsStaked) * Number(colsPrice || 0)).toFixed(2)}
          </div>
        </div>

        <div className={styles.assetCard} style={{ minWidth: 260 }}>
          <div className={styles.assetLabel}>Total Value (USD)</div>
          <div className={styles.totalValue}>
            ${Number.isFinite(totalUsd) ? Math.floor(totalUsd).toLocaleString() : '0'}
          </div>
          <div className={styles.hint}>
            Prices: COLS ${Number(colsPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} • eGLD ${Number(egldPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </section>

      <section className={styles.aprPanel} style={{ textAlign: 'center' }}>
        <div className={styles.APRHeader} style={{ fontSize: 24, fontWeight: 700, background: aprColor, color: '#fff', borderRadius: 8, padding: '4px 12px', display: 'inline-block', marginBottom: 8 }}>
          <span>Total APR&nbsp;&nbsp;</span>
          <span className={styles.aprValue} style={{ fontSize: 28, fontWeight: 900 }}>
            {loading ? <><AnimatedDots /> </> : aprTotal !== null ? Number(aprTotal).toFixed(2) : '—'}%
          </span>
          <HelpIcon text={totalAprHelpText} />
        </div>
        <div style={{ marginTop: 8, fontWeight: 600, fontSize: 18, color: '#6ee7c7' }}>
          Base APR: {loading ? <AnimatedDots /> : baseApr.toFixed(2)}%
          <HelpIcon text="Base APR is the standard annual percentage rate for all delegators, before any COLS bonus." />
        </div>
        <div className={styles.ranking} style={{ marginTop: 16, fontSize: 20, fontWeight: 700, color: '#fff', background: aprColor, padding: '4px 16px', borderRadius: 8, boxShadow: '0 2px 8px #fff8', display: 'inline-block', margin: '16px auto 0 auto' }}>
          <span>Your rank: </span>
          <span>
            {loading
              ? '...'
              : rank !== null
                ? `${rank} out of ${totalStakers} COLS stakers`
                : 'N/A'}
          </span>
          <HelpIcon text="Ranking is based on your total APR compared to other stakers. The more COLS you stake (relative to your eGLD), the higher your rank." />
        </div>
      </section>

      <RankingTable />
      <ColsAprTable />
    </div>
  );
};

export default Home;
