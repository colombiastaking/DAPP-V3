import { useEffect, useState } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useNavigate } from 'react-router-dom';
import { useColsAprContext } from '../../context/ColsAprContext';
import { useGlobalContext } from 'context';
import { AnimatedDots } from 'components/AnimatedDots';
import styles from './Info.module.scss';

const NUMBER_OF_NODES = 50;
const SOLAR_POWER_KW = 5.75;
const CPU_CORES = 60;
const MACHINES = 9;
const ISP_COUNT = 4;

// Node status interface
interface NodeStatus {
  name: string;
  status: string;
  nonce: number;
  epoch: number;
  peers: number;
  blocksBehind: number;
  version: string;
  cpu: { percent: number; model: string; cores: string };
  memory: { percent: number; usedGB: number; totalGB: number; ram: string };
  txPool: number;
}

interface StatusData {
  timestamp: string;
  epoch: number;
  thresholds: { cpu: number; memory: number; peers: number; txPool: number };
  nodes: NodeStatus[];
}

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
  const account = useGetAccount();
  const address = account.address;
  const navigate = useNavigate();
  const { loading, stakers, egldPrice, colsPrice, baseApr, agencyLockedEgld } = useColsAprContext();
  const { delegatorCount } = useGlobalContext();
  const [isMobile, setIsMobile] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<StatusData | null>(null);
  const [nodeStatusLoading, setNodeStatusLoading] = useState(true);

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

  // Fetch node status
  useEffect(() => {
    const fetchNodeStatus = async () => {
      try {
        const response = await fetch('https://colombia-staking.com/status.json');
        if (response.ok) {
          const data = await response.json();
          setNodeStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch node status:', error);
      } finally {
        setNodeStatusLoading(false);
      }
    };
    
    fetchNodeStatus();
    // Refresh every 2 minutes
    const interval = setInterval(fetchNodeStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  // Get delegator count from cached context
  const delegatorCountValue = delegatorCount.status === 'loaded' ? delegatorCount.data : null;

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
                  {delegatorCountValue !== null ? delegatorCountValue.toLocaleString() : 
                   delegatorCount.status === 'loading' ? '...' : '—'}
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

          {/* Infrastructure Section */}
          <div className={styles.infraSection}>
            <h2 className={styles.sectionTitle}>🖥️ Infrastructure</h2>
            <div className={styles.infraGrid}>
              {/* Solar Power */}
              <div className={styles.infraCard}>
                <div className={styles.infraIcon}>☀️</div>
                <div className={styles.infraContent}>
                  <div className={styles.infraLabel}>Solar Power</div>
                  <div className={styles.infraValue}>{SOLAR_POWER_KW} kW</div>
                  <div className={styles.infraSubtext}>Clean energy</div>
                </div>
              </div>

              {/* CPU Cores */}
              <div className={styles.infraCard}>
                <div className={styles.infraIcon}>⚙️</div>
                <div className={styles.infraContent}>
                  <div className={styles.infraLabel}>CPU Cores</div>
                  <div className={styles.infraValue}>{CPU_CORES}</div>
                  <div className={styles.infraSubtext}>Total processing power</div>
                </div>
              </div>

              {/* Machines */}
              <div className={styles.infraCard}>
                <div className={styles.infraIcon}>🖥️</div>
                <div className={styles.infraContent}>
                  <div className={styles.infraLabel}>Machines</div>
                  <div className={styles.infraValue}>{MACHINES}</div>
                  <div className={styles.infraSubtext}>Validator servers</div>
                </div>
              </div>

              {/* ISP */}
              <div className={styles.infraCard}>
                <div className={styles.infraIcon}>🌐</div>
                <div className={styles.infraContent}>
                  <div className={styles.infraLabel}>ISP Connections</div>
                  <div className={styles.infraValue}>{ISP_COUNT}</div>
                  <div className={styles.infraSubtext}>Redundant connectivity</div>
                </div>
              </div>
            </div>
          </div>

          {/* Node Status Section */}
          <div className={styles.nodeStatusSection}>
            <h2 className={styles.sectionTitle}>🟢 Node Status</h2>
            <p className={styles.sectionSubtitle}>
              Real-time status of our displayed validator nodes
            </p>
            
            {nodeStatusLoading ? (
              <div className={styles.loadingContainer}>
                <AnimatedDots />
              </div>
            ) : nodeStatus && nodeStatus.nodes ? (
              <>
                <div className={styles.nodeStatusGrid}>
                  {nodeStatus.nodes.map((node) => (
                    <div key={node.name} className={`${styles.nodeCard} ${styles[node.status.toLowerCase()]}`}>
                      <div className={styles.nodeHeader}>
                        <span className={styles.nodeName}>{node.name}</span>
                        <span className={`${styles.statusBadge} ${styles[node.status.toLowerCase()]}`}>
                          {node.status === 'SYNC' && '✓'}
                          {node.status === 'SLOW' && '⚠'}
                          {node.status === 'LAG' && '🔄'}
                          {node.status === 'DESYNC' && '✗'}
                          {node.status === 'ERROR' && '💀'}
                          {' '}{node.status}
                        </span>
                      </div>
                      
                      <div className={styles.nodeMetrics}>
                        <div className={styles.metricPair}>
                          <span className={styles.metricLabel}>CPU</span>
                          <div className={styles.metricBar}>
                            <div 
                              className={`${styles.metricFill} ${node.cpu.percent > 80 ? styles.danger : node.cpu.percent > 50 ? styles.warning : ''}`}
                              style={{ width: `${node.cpu.percent}%` }}
                            />
                          </div>
                          <span className={styles.metricValue}>{node.cpu.percent}%</span>
                        </div>
                        
                        <div className={styles.metricPair}>
                          <span className={styles.metricLabel}>RAM</span>
                          <div className={styles.metricBar}>
                            <div 
                              className={`${styles.metricFill} ${node.memory.percent > 90 ? styles.danger : node.memory.percent > 70 ? styles.warning : ''}`}
                              style={{ width: `${node.memory.percent}%` }}
                            />
                          </div>
                          <span className={styles.metricValue}>{node.memory.percent}%</span>
                        </div>
                      </div>
                      
                      <div className={styles.nodeDetails}>
                        <span>🌐 {node.peers} peers</span>
                        <span>📦 {node.txPool} tx</span>
                        {!isMobile && <span>⏱️ {node.blocksBehind} behind</span>}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className={styles.statusFooter}>
                  <span>Epoch: {nodeStatus.epoch}</span>
                  <span>•</span>
                  <span>Updated: {new Date(Number(nodeStatus.timestamp) * 1000).toLocaleTimeString()}</span>
                </div>
              </>
            ) : (
              <div className={styles.statusUnavailable}>
                <p>⚠️ Node status temporarily unavailable</p>
                <a 
                  href="https://colombia-staking.com/node-status.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.statusLink}
                >
                  View on website →
                </a>
              </div>
            )}
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
            
            {/* COLS Token Properties */}
            <div className={styles.colsProperties}>
              <h3 className={styles.colsPropsTitle}>📜 COLS Token Properties</h3>
              <ul className={styles.colsPropsList}>
                <li><strong>Max Supply:</strong> 150,000 COLS (fixed, never more)</li>
                <li><strong>Already Circulating:</strong> All 150,000 COLS in circulation</li>
                <li><strong>Token Utility:</strong> Staking + DAO rewards + Bonus APR</li>
              </ul>
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
              Colombia Staking — 50 nodes securing the MultiversX network from Colombia 🇨🇴
            </p>
          </div>
        </>
      )}
    </div>
  );
};