import { useEffect, useState } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useNavigate } from 'react-router-dom';
import { useColsAprContext } from '../../context/ColsAprContext';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './Info.module.scss';

const NUMBER_OF_NODES = 48;

// Animal leagues (same as RankingTable)
const ANIMAL_LEAGUES = [
  { name: 'Leviathan', icon: '🐉', color: '#9c27b0', range: [0, 1] },
  { name: 'Whale', icon: '🐋', color: '#2196f3', range: [1, 5] },
  { name: 'Shark', icon: '🦈', color: '#03a9f4', range: [5, 15] },
  { name: 'Dolphin', icon: '🐬', color: '#00bcd4', range: [15, 30] },
  { name: 'Pufferfish', icon: '🐡', color: '#4caf50', range: [30, 50] },
  { name: 'Fish', icon: '🐟', color: '#8bc34a', range: [50, 70] },
  { name: 'Crab', icon: '🦀', color: '#ff9800', range: [70, 90] },
  { name: 'Shrimp', icon: '🦐', color: '#f44336', range: [90, 100] }
];

function getLeague(rank: number, total: number) {
  const percentile = (rank / total) * 100;
  return (
    ANIMAL_LEAGUES.find((l) => percentile > l.range[0] && percentile <= l.range[1]) ||
    ANIMAL_LEAGUES[ANIMAL_LEAGUES.length - 1]
  );
}

function formatNumber(num: number, decimals = 2): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(decimals) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(decimals) + 'K';
  }
  return num.toFixed(decimals);
}

export const Info = () => {
  const { address } = useGetAccountInfo();
  const navigate = useNavigate();
  const { loading, stakers, egldPrice, colsPrice, baseApr, agencyLockedEgld } = useColsAprContext();
  const [delegatorCount, setDelegatorCount] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!address) {
      navigate('/unlock');
    }
  }, [address, navigate]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 700);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch delegator count from API
  useEffect(() => {
    const fetchDelegatorCount = async () => {
      try {
        const res = await fetch(
          'https://staking.colombia-staking.com/mvx-api/providers/erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf'
        );
        const data = await res.json();
        if (data?.numUsers) {
          setDelegatorCount(data.numUsers);
        } else if (data?.accounts) {
          setDelegatorCount(data.accounts);
        }
      } catch {
        // Fallback: count from stakers with eGLD
        const count = stakers.filter((s: any) => s.egldStaked > 0).length;
        setDelegatorCount(count > 0 ? count : null);
      }
    };
    fetchDelegatorCount();
  }, [stakers]);

  // Calculate total COLS staked
  const totalColsStaked = stakers.reduce((sum: number, s: any) => sum + (s.colsStaked || 0), 0);

  // Total eGLD in USD
  const totalEgldUsd = agencyLockedEgld && egldPrice ? agencyLockedEgld * egldPrice : 0;

  // Top 10 COLS stakers
  const topStakers = [...stakers]
    .filter((s: any) => s.colsStaked > 0)
    .sort((a: any, b: any) => (b.colsStaked || 0) - (a.colsStaked || 0))
    .slice(0, 10);

  // Get total stakers for league calculation
  const totalStakers = stakers.length;

  return (
    <div className={styles.infoPage}>
      {/* Header Banner */}
      <div className={styles.headerBanner}>
        <h1 className={styles.title}>📊 Colombia Staking Info</h1>
        <p className={styles.subtitle}>"Your trusted staking provider since 2020"</p>
      </div>

      {loading ? (
        <div className={styles.loadingContainer}>
          <AnimatedDots />
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className={styles.statsGrid}>
            {/* Nodes */}
            <div className={styles.statCard}>
              <div className={styles.statIcon}>🖥️</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Active Nodes</div>
                <div className={styles.statValue}>{NUMBER_OF_NODES}</div>
                <div className={styles.statSubtext}>Validating on MultiversX</div>
              </div>
            </div>

            {/* Total eGLD Staked */}
            <div className={styles.statCard}>
              <div className={styles.statIcon}>💎</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Total eGLD Staked</div>
                <div className={styles.statValue}>
                  {agencyLockedEgld ? formatNumber(agencyLockedEgld, 0) : '—'}
                </div>
                <div className={styles.statSubtext}>
                  ≈ ${totalEgldUsd ? formatNumber(totalEgldUsd, 0) : '—'}
                </div>
              </div>
            </div>

            {/* Delegators */}
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Delegators</div>
                <div className={styles.statValue}>
                  {delegatorCount !== null ? delegatorCount.toLocaleString() : '—'}
                </div>
                <div className={styles.statSubtext}>Trusting our nodes</div>
              </div>
            </div>

            {/* Base APR */}
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📈</div>
              <div className={styles.statContent}>
                <div className={styles.statLabel}>Base APR</div>
                <div className={styles.statValue}>
                  {baseApr ? baseApr.toFixed(2) + '%' : '—'}
                </div>
                <div className={styles.statSubtext}>From blockchain rewards</div>
              </div>
            </div>
          </div>

          {/* Prices Section */}
          <div className={styles.pricesSection}>
            <h2 className={styles.sectionTitle}>💲 Token Prices</h2>
            <div className={styles.pricesGrid}>
              <div className={styles.priceCard}>
                <div className={styles.tokenLogo}>🔵</div>
                <div className={styles.priceInfo}>
                  <div className={styles.tokenName}>eGLD</div>
                  <div className={styles.priceValue}>
                    ${egldPrice ? egldPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </div>
                </div>
              </div>
              <div className={styles.priceCard}>
                <div className={styles.tokenLogo}>🟣</div>
                <div className={styles.priceInfo}>
                  <div className={styles.tokenName}>COLS</div>
                  <div className={styles.priceValue}>
                    ${colsPrice ? Number(colsPrice).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLS Staking Stats */}
          <div className={styles.colsSection}>
            <h2 className={styles.sectionTitle}>🎯 COLS Staking</h2>
            <div className={styles.colsStats}>
              <div className={styles.colsStat}>
                <span className={styles.colsLabel}>Total COLS Staked</span>
                <span className={styles.colsValue}>
                  {totalColsStaked ? formatNumber(totalColsStaked, 0) : '—'}
                </span>
              </div>
              <div className={styles.colsStat}>
                <span className={styles.colsLabel}>COLS Stakers</span>
                <span className={styles.colsValue}>
                  {stakers.filter((s: any) => s.colsStaked > 0).length.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Top 10 COLS Stakers */}
          <div className={styles.topStakersSection}>
            <h2 className={styles.sectionTitle}>🏆 Top 10 COLS Stakers</h2>
            <p className={styles.sectionSubtitle}>
              Ranked by COLS tokens staked
            </p>
            
            <div className={styles.tableContainer}>
              <table className={styles.stakersTable}>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Address</th>
                    <th>COLS Staked</th>
                    <th>eGLD Staked</th>
                    <th>Total APR</th>
                    <th>League</th>
                  </tr>
                </thead>
                <tbody>
                  {topStakers.map((staker: any, index: number) => {
                    const league = staker.rank && totalStakers 
                      ? getLeague(staker.rank, totalStakers) 
                      : ANIMAL_LEAGUES[7];
                    const shortAddress = `${staker.address.slice(0, 6)}...${staker.address.slice(-4)}`;
                    
                    return (
                      <tr key={staker.address}>
                        <td className={styles.rankCell}>
                          {index === 0 && '🥇'}
                          {index === 1 && '🥈'}
                          {index === 2 && '🥉'}
                          {index > 2 && `#${index + 1}`}
                        </td>
                        <td className={styles.addressCell}>
                          <a 
                            href={`https://explorer.multiversx.com/accounts/${staker.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.addressLink}
                          >
                            {shortAddress}
                          </a>
                        </td>
                        <td className={styles.numberCell}>
                          {staker.colsStaked ? formatNumber(staker.colsStaked, 0) : '—'}
                        </td>
                        <td className={styles.numberCell}>
                          {staker.egldStaked ? formatNumber(staker.egldStaked, 2) : '—'}
                        </td>
                        <td className={styles.aprCell}>
                          {staker.aprTotal ? staker.aprTotal.toFixed(2) + '%' : '—'}
                        </td>
                        <td>
                          <span 
                            className={styles.leagueBadge}
                            style={{ 
                              background: `linear-gradient(135deg, ${league.color}99, ${league.color})` 
                            }}
                          >
                            {league.icon} {!isMobile && league.name}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Footer */}
          <div className={styles.infoFooter}>
            <div className={styles.linksRow}>
              <a 
                href="https://colombia-staking.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.footerLink}
              >
                🌐 Website
              </a>
              <a 
                href="https://t.me/ColombiaStakingChat" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.footerLink}
              >
                💬 Telegram
              </a>
              <a 
                href="https://x.com/ColombiaStaking" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.footerLink}
              >
                𝕏 Twitter
              </a>
              <a 
                href="https://github.com/colombiastaking" 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.footerLink}
              >
                📂 GitHub
              </a>
            </div>
            <p className={styles.footerText}>
              Colombia Staking — 48 nodes securing the MultiversX network from Colombia 🇨🇴
            </p>
          </div>
        </>
      )}
    </div>
  );
};