import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useEffect, useState } from 'react';
import { decodeBigNumber, ContractFunction, Address, AddressValue } from '@multiversx/sdk-core';
import { createContractQuery } from 'helpers/contractQuery';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';

import { RankingTable } from 'components/Stake/RankingTable';
import { useColsAprContext } from '../../context/ColsAprContext';
import { AnimatedDots } from 'components/AnimatedDots';
import { HelpIcon } from 'components/HelpIcon';
import { ColsAprTable } from 'components/ColsAprTable';
import { usePreloadData } from 'hooks/usePreloadData';

import styles from './styles.module.scss';

const denomination = 1e18;

function formatNumber(amount: number | string, decimals = 6) {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.floor(value).toLocaleString()}`;
}

export const Home = () => {
  const account = useGetAccount();
  const address = account.address;
  const { stakers, loading, egldPrice, colsPrice, baseApr } = useColsAprContext();
  
  // Preload all cached data at login
  usePreloadData();

  const [additionalEgldDelegatedRaw, setAdditionalEgldDelegatedRaw] = useState<string | null>(null);
  const [loadingAdditionalEgld, setLoadingAdditionalEgld] = useState(false);

  // Find user row in stakers
  const userRow = stakers.find((s: any) => s.address === address) ?? null;

  // Current user delegated and staked amounts
  const egldDelegatedFromApr = userRow?.egldStaked ?? 0;
  const colsStaked = userRow?.colsStaked ?? 0;

  // Convert raw value to eGLD decimals
  const additionalEgldDelegated = additionalEgldDelegatedRaw
    ? (Number(additionalEgldDelegatedRaw) / denomination).toString()
    : null;

  const actualEgldDelegated = +colsStaked === 0 && additionalEgldDelegated !== null
    ? Number(additionalEgldDelegated)
    : Number(egldDelegatedFromApr);

  const totalUsd =
    (actualEgldDelegated * Number(egldPrice || 0)) +
    (Number(colsStaked) * Number(colsPrice || 0));

  const totalStakers = stakers.length;

  // Fetch delegated eGLD if no COLS staked
  useEffect(() => {
    let mounted = true;
    if (!address || colsStaked > 0) {
      setAdditionalEgldDelegatedRaw(null);
      setLoadingAdditionalEgld(false);
      return () => { mounted = false; };
    }

    setLoadingAdditionalEgld(true);

    async function fetchDelegatedEgld() {
      try {
        const provider = new ProxyNetworkProvider('https://gateway.multiversx.com');
        const q = createContractQuery({
          address: new Address('erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf'),
          func: new ContractFunction('getUserActiveStake'),
          args: [new AddressValue(new Address(address))]
        });

        const response = await provider.queryContract(q);
        const parts = response.getReturnDataParts();

        if (parts.length > 0) {
          const delegatedRaw = decodeBigNumber(parts[0]).toFixed();
          if (mounted) setAdditionalEgldDelegatedRaw(delegatedRaw);
        } else {
          if (mounted) setAdditionalEgldDelegatedRaw('0');
        }
      } catch (e) {
        if (mounted) setAdditionalEgldDelegatedRaw('0');
      }
      if (mounted) setLoadingAdditionalEgld(false);
    }

    fetchDelegatedEgld();

    return () => { mounted = false; };
  }, [address, colsStaked]);

  const totalAprHelpText = `Total APR represents your annual percentage rate based on your staking position.

• If you have eGLD delegated, the Total APR applies to your eGLD delegation.
• If you stake COLS tokens, you earn additional APR bonus.

This ensures the APR reflects your actual staking position.`;

  const userApr = userRow?.aprTotal !== null && userRow?.aprTotal !== undefined 
    ? Number(userRow.aprTotal) 
    : null;
  const userRank = userRow?.rank;
  const leagueInfo = userRank && totalStakers > 0 
    ? getLeagueInfo(userRank, totalStakers) 
    : null;

  return (
    <div className={styles.landing}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroHeader}>
          <h1 className={styles.heroGreeting}>
            Welcome, <span>Staker</span> 👋
          </h1>
          <div className={styles.heroBadge}>
            {loading ? <AnimatedDots /> : `${totalStakers.toLocaleString()} Stakers`}
          </div>
        </div>

        {/* Asset Cards Grid */}
        <div className={styles.assetGrid}>
          {/* eGLD Card */}
          <div className={styles.assetCard}>
            <div className={styles.assetIcon}>💎</div>
            <div className={styles.assetLabel}>eGLD Delegated</div>
            <div className={`${styles.assetValue} ${styles.assetValuePrimary}`}>
              {loading || loadingAdditionalEgld ? (
                <><AnimatedDots /></>
              ) : (
                formatNumber(actualEgldDelegated, 4)
              )}
            </div>
            <div className={styles.assetUsd}>
              ≈ ${Math.floor(actualEgldDelegated * Number(egldPrice || 0)).toLocaleString()}
            </div>
          </div>

          {/* COLS Card */}
          <div className={styles.assetCardAccent}>
            <div className={styles.assetIconAccent}>🪙</div>
            <div className={styles.assetLabel}>COLS Staked</div>
            <div className={`${styles.assetValue} ${styles.assetValueAccent}`}>
              {loading ? <><AnimatedDots /></> : formatNumber(colsStaked, 2)}
            </div>
            <div className={styles.assetUsd}>
              ≈ ${(Number(colsStaked) * Number(colsPrice || 0)).toFixed(2)}
            </div>
          </div>

          {/* Total Value Card */}
          <div className={styles.assetCardTotal}>
            <div className={styles.assetIcon}>💰</div>
            <div className={styles.assetLabel}>Total Portfolio Value</div>
            <div className={styles.totalValue}>
              {Number.isFinite(totalUsd) ? formatCurrency(totalUsd) : '$0'}
            </div>
            <div className={styles.hint}>
              COLS ${Number(colsPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} 
              {' '}• eGLD ${Number(egldPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </section>

      {/* APR Panel */}
      <section className={styles.aprPanel}>
        <div className={styles.aprHeader}>
          Your Total APR
          <HelpIcon text={totalAprHelpText} />
        </div>

        <div className={styles.aprCard}>
          <div className={styles.aprLabel}>Annual Percentage Rate</div>
          <div className={`${styles.aprValue} ${styles.aprValueLarge}`}>
            {loading ? <><AnimatedDots /></> : userApr !== null ? `${userApr.toFixed(2)}%` : '—'}
          </div>
        </div>

        <div className={styles.baseAprRow}>
          Base APR: <span className={styles.baseAprValue}>
            {loading ? <AnimatedDots /> : `${baseApr.toFixed(2)}%`}
          </span>
          <HelpIcon text="Base APR is the standard annual percentage rate for all delegators, before any COLS bonus." />
        </div>

        {/* Ranking Badge */}
        {userRank !== null && userRank !== undefined && (
          <div className={styles.rankingBadge}>
            <span className={styles.rankingBadgeIcon}>{leagueInfo?.icon}</span>
            <span>
              Rank <span className={styles.rankingBadgeRank}>#{userRank}</span> of {totalStakers.toLocaleString()}
            </span>
          </div>
        )}

        {/* Stats Row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <div className={`${styles.statValue} ${styles.statValuePrimary}`}>
              {userApr !== null ? `${(userApr - baseApr).toFixed(2)}%` : '—'}
            </div>
            <div className={styles.statLabel}>Bonus APR</div>
          </div>
          <div className={styles.statItem}>
            <div className={`${styles.statValue} ${styles.statValueAccent}`}>
              {leagueInfo?.name || '—'}
            </div>
            <div className={styles.statLabel}>Your League</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>
              {((actualEgldDelegated * Number(egldPrice || 0) + Number(colsStaked) * Number(colsPrice || 0)) > 0)
                ? `$${Math.floor(actualEgldDelegated * Number(egldPrice || 0) + Number(colsStaked) * Number(colsPrice || 0)).toLocaleString()}`
                : '$0'}
            </div>
            <div className={styles.statLabel}>Est. Yearly Reward</div>
          </div>
        </div>
      </section>

      {/* Ranking Table */}
      <RankingTable />
      
      {/* Admin Table (only visible for target user) */}
      <ColsAprTable />
    </div>
  );
};

// League info helper
function getLeagueInfo(rank: number, total: number) {
  const percentile = (rank / total) * 100;
  
  const leagues = [
    { name: 'Leviathan', icon: '🐉', color: '#9c27b0', range: [0, 1] },
    { name: 'Whale', icon: '🐋', color: '#2196f3', range: [1, 5] },
    { name: 'Shark', icon: '🦈', color: '#03a9f4', range: [5, 15] },
    { name: 'Dolphin', icon: '🐬', color: '#00bcd4', range: [15, 30] },
    { name: 'Pufferfish', icon: '🐡', color: '#4caf50', range: [30, 50] },
    { name: 'Fish', icon: '🐟', color: '#8bc34a', range: [50, 70] },
    { name: 'Crab', icon: '🦀', color: '#ff9800', range: [70, 90] },
    { name: 'Shrimp', icon: '🦐', color: '#f44336', range: [90, 100] },
  ];

  return leagues.find(l => percentile > l.range[0] && percentile <= l.range[1]) || leagues[leagues.length - 1];
}

export default Home;