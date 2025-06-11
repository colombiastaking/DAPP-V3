import React, { useEffect, useState } from 'react';
import { faLock, faGift, faPercent } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetActiveTransactionsStatus } from '@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import classNames from 'classnames';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';

import { MultiversX } from 'assets/MultiversX';
import { network } from 'config';
import { useGlobalContext } from 'context';
import { denominated } from 'helpers/denominate';

import { Delegate } from './components/Delegate';
import { Undelegate } from './components/Undelegate';
import { StakeCols } from './components/StakeCols';
import { WithdrawCols } from './components/WithdrawCols';

import useStakeData from './hooks';
import { useColsAprContext } from '../../context/ColsAprContext';

import styles from './styles.module.scss';

const CLAIM_COLS_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const CLAIM_COLS_DATA = 'claimRewards@00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787';
const CLAIM_COLS_GAS_LIMIT = 10_000_000;

// Helper to denominate COLS (18 decimals)
function denominateCols(raw: string, addCommas = true) {
  if (!raw || raw === '0') return '0';
  let str = raw.padStart(19, '0');
  const intPart = str.slice(0, -18) || '0';
  let decPart = raw.length > 18 ? str.slice(-18).replace(/0+$/, '') : '';
  let result = decPart ? `${intPart}.${decPart}` : intPart;
  if (addCommas) {
    // Add thousands separator to int part
    const [i, d] = result.split('.');
    result = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : '');
  }
  return result;
}

const ClaimCols = ({
  onClaimed
}: {
  onClaimed: () => void;
}) => {
  const { pending } = useGetActiveTransactionsStatus();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleClaimCols = async () => {
    setError(null);
    setLoading(true);
    try {
      await sendTransactions({
        transactions: [
          {
            value: '0',
            data: CLAIM_COLS_DATA,
            receiver: CLAIM_COLS_CONTRACT,
            gasLimit: CLAIM_COLS_GAS_LIMIT
          }
        ]
      });
      setLoading(false);
      onClaimed();
    } catch (e: any) {
      setError(e?.message || 'Failed to send transaction');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      style={{
        background: '#27C180',
        color: '#fff',
        fontWeight: 700,
        borderRadius: 7,
        padding: '15px 30px',
        border: 'none',
        marginRight: 0,
        marginBottom: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 16
      }}
      onClick={handleClaimCols}
      className={classNames(styles.action)}
      disabled={pending || loading}
    >
      <span role="img" aria-label="fire">🔥</span>
      Claim COLS
      <span role="img" aria-label="fire">🔥</span>
      {loading && (
        <span style={{ marginLeft: 8, fontSize: 14 }}>...</span>
      )}
      {error && (
        <span className={styles.error} style={{ marginLeft: 8 }}>{error}</span>
      )}
    </button>
  );
};

// --- Simulation logic ---
function simulateAprAndRank({
  stakers,
  address,
  simulatedColsStaked,
  colsPrice,
  egldPrice,
  baseApr,
  serviceFee
}: {
  stakers: any[];
  address: string;
  simulatedColsStaked: number;
  colsPrice: number;
  egldPrice: number;
  baseApr: number;
  serviceFee: number;
}) {
  const APRmin = 0.01;
  const APRmax = 15;
  const AGENCY_BUYBACK = 0.3;
  const DAO_DISTRIBUTION_RATIO = 0.333;

  // Build a new stakers array with the simulated value for the user
  const newStakers = stakers.map(s =>
    s.address === address
      ? { ...s, colsStaked: simulatedColsStaked }
      : s
  );

  // Recalculate ratios
  for (const row of newStakers) {
    if (row.egldStaked > 0 && colsPrice > 0 && egldPrice > 0) {
      row.ratio = (row.colsStaked * colsPrice) / (row.egldStaked * egldPrice);
    } else {
      row.ratio = null;
    }
  }
  // Normalize
  const validRatios = newStakers.filter(r => r.ratio !== null).map(r => r.ratio);
  const minRatio = validRatios.length > 0 ? Math.min(...validRatios) : 0;
  const maxRatio = validRatios.length > 0 ? Math.max(...validRatios) : 0;
  for (const row of newStakers) {
    if (row.ratio !== null && maxRatio !== minRatio) {
      row.normalized = (row.ratio - minRatio) / (maxRatio - minRatio);
    } else {
      row.normalized = null;
    }
  }
  // APR Bonus
  for (const row of newStakers) {
    if (row.normalized !== null) {
      row.aprBonus = APRmin + (APRmax - APRmin) * Math.sqrt(row.normalized);
    } else {
      row.aprBonus = null;
    }
  }
  // DAO
  const totalEgldStaked = newStakers.reduce((sum, r) => sum + (r.egldStaked || 0), 0);
  const sumColsStaked = newStakers.reduce((sum, r) => sum + (r.colsStaked || 0), 0);
  for (const row of newStakers) {
    if (row.egldStaked > 0 && row.colsStaked > 0 && sumColsStaked > 0) {
      const baseAprCorrected = baseApr / (1 - serviceFee) / 100;
      const dao = (
        (
          (
            totalEgldStaked *
            baseAprCorrected *
            AGENCY_BUYBACK *
            serviceFee *
            DAO_DISTRIBUTION_RATIO *
            row.colsStaked
          ) / sumColsStaked
        ) / row.egldStaked
      ) * 100;
      row.dao = dao;
    } else {
      row.dao = null;
    }
  }
  // APR_TOTAL
  for (const row of newStakers) {
    if (row.egldStaked > 0) {
      row.aprTotal = baseApr + (row.aprBonus || 0) + (row.dao || 0);
    } else {
      row.aprTotal = baseApr;
    }
  }
  // Ranking
  const sorted = [...newStakers].sort((a, b) => (b.aprTotal || 0) - (a.aprTotal || 0));
  for (let i = 0; i < sorted.length; ++i) {
    sorted[i].rank = i + 1;
  }
  for (const row of newStakers) {
    const found = sorted.find(r => r.address === row.address);
    row.rank = found ? found.rank : null;
  }
  // Find the simulated user's new APR and rank
  const user = newStakers.find(s => s.address === address);
  return {
    newApr: user && user.aprTotal ? user.aprTotal : null,
    newRank: user && user.rank ? user.rank : null
  };
}

export const Stake = () => {
  const { pending } = useGetActiveTransactionsStatus();
  const { address } = useGetAccountInfo();
  const { userActiveStake, userClaimableRewards, stakedCols } = useGlobalContext();
  const { onRedelegate, onClaimRewards } = useStakeData();

  // Loading/Error/Empty state logic
  const isLoading =
    userActiveStake.status === 'loading' ||
    userClaimableRewards.status === 'loading';
  const isError =
    userActiveStake.status === 'error' ||
    userClaimableRewards.status === 'error';
  const isEmpty =
    userActiveStake.data === '0' && userClaimableRewards.data === '0';

  // --- Use live COLS APR data for user APR/ranking ---
  const { loading: aprLoading, stakers, baseApr, egldPrice, colsPrice } = useColsAprContext();
  const [userApr, setUserApr] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    if (!address || !Array.isArray(stakers) || stakers.length === 0) {
      setUserApr(null);
      setUserRank(null);
      return;
    }
    const idx = stakers.findIndex((s) => s.address === address);
    if (idx === -1) {
      setUserApr(null);
      setUserRank(null);
    } else {
      setUserApr(stakers[idx].aprTotal ?? null);
      setUserRank(stakers[idx].rank ?? null);
    }
  }, [address, stakers]);

  // --- Simulation state ---
  const [simulatedCols, setSimulatedCols] = useState<string>('');
  const [simResult, setSimResult] = useState<{ newApr: number | null; newRank: number | null } | null>(null);
  const [simError, setSimError] = useState<string | null>(null);

  // Find user's current eGLD staked
  let userEgldStaked = 0;
  if (Array.isArray(stakers) && address) {
    const user = stakers.find(s => s.address === address);
    if (user && typeof user.egldStaked === 'number') {
      userEgldStaked = user.egldStaked;
    }
  }

  // Get serviceFee for simulation
  let serviceFee = 0.1;
  const { contractDetails } = useGlobalContext();
  if (
    contractDetails &&
    contractDetails.data &&
    typeof contractDetails.data.serviceFee === 'string'
  ) {
    const feeStr = contractDetails.data.serviceFee.replace('%', '').trim();
    const feeNum = parseFloat(feeStr);
    if (!isNaN(feeNum)) {
      serviceFee = feeNum / 100;
    }
  }

  // Handle simulation apply
  const handleSimulate = () => {
    setSimError(null);
    setSimResult(null);
    if (!address) {
      setSimError('Not logged in');
      return;
    }
    if (!userEgldStaked || userEgldStaked <= 0) {
      setSimError('You must have eGLD staked to simulate');
      return;
    }
    let val = 0;
    try {
      val = parseFloat(simulatedCols);
      if (isNaN(val) || val < 0) throw new Error();
    } catch {
      setSimError('Invalid COLS value');
      return;
    }
    // Use already loaded stakers, prices, etc.
    const result = simulateAprAndRank({
      stakers,
      address,
      simulatedColsStaked: val,
      colsPrice,
      egldPrice,
      baseApr,
      serviceFee
    });
    setSimResult(result);
  };

  // Panels and UI
  return (
    <div
      className={classNames(
        styles.stake,
        { [styles.empty]: isLoading || isError || isEmpty },
        'stake'
      )}
    >
      {isLoading || isError || isEmpty ? (
        <div className={styles.wrapper}>
          <strong className={styles.heading}>
            Welcome to Colombia Staking Dashboard!
          </strong>

          <div className={styles.logo}>
            <MultiversX />

            <div style={{ background: '#2044F5' }} className={styles.subicon}>
              <FontAwesomeIcon icon={faLock} />
            </div>
          </div>

          <div className={styles.message}>
            {isLoading
              ? 'Retrieving staking data...'
              : isError
              ? 'There was an error trying to retrieve staking data.'
              : `Currently you don't have any ${network.egldLabel} staked.`}
          </div>

          <Delegate />
          <StakeCols />
        </div>
      ) : (
        <div className={styles.assetsRow}>
          {/* Active Assets Panel */}
          <div className={styles.assetsBox}>
            <div className={styles.icon}>
              <MultiversX />
              <div style={{ background: '#2044F5' }} className={styles.subicon}>
                <FontAwesomeIcon icon={faLock} />
              </div>
            </div>
            <div className={styles.title}>Active Assets</div>
            <div className={styles.activeAmountsRow}>
              <span className={styles.activeAmount}>
                <b>
                  {denominated(userActiveStake.data || '...', { addCommas: true })} {network.egldLabel}
                </b>
                <div className={styles.activeLabel}>delegated</div>
              </span>
              <span className={styles.activeAmount}>
                <b>
                  {stakedCols.status === 'loaded'
                    ? denominateCols(stakedCols.data || '0', true)
                    : '...'} COLS
                </b>
                <div className={styles.activeLabel}>staked</div>
              </span>
            </div>
            <div className={styles.actionsRow}>
              <div className={styles.actionButtonWrapper}><Delegate /></div>
              <div className={styles.actionButtonWrapper}><StakeCols /></div>
              <div className={styles.actionButtonWrapper}><Undelegate /></div>
              <div className={styles.actionButtonWrapper}><WithdrawCols /></div>
            </div>
          </div>
          {/* APR Panel */}
          <div
            className={styles.assetsBox}
            style={{
              borderColor: '#ffb74d',
              background: 'linear-gradient(180deg, #ffb74d 0%, #ffe0b2 100%)',
              color: '#000',
              minWidth: 220
            }}
          >
            <div className={styles.icon} style={{ background: '#fff3e0' }}>
              <FontAwesomeIcon icon={faPercent} style={{ color: '#ff9800', fontSize: 32 }} />
            </div>
            <div className={styles.title} style={{ color: '#000' }}>APR for your eGLD</div>
            <div className={styles.aprInfo}>
              <div>
                <b>Base APR:</b>
                <span className={styles.aprValue} style={{ color: '#000', background: 'none' }}>
                  {aprLoading ? '...' : Number(baseApr).toFixed(2)}%
                </span>
              </div>
              <div>
                <b>Total APR with Bonus:</b>
                <span
                  className={styles.aprValue}
                  style={{
                    color: '#b71c1c',
                    fontWeight: 700,
                    background: 'none'
                  }}
                >
                  <span style={{
                    color: '#b71c1c',
                    background: 'none',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 700,
                    fontSize: 18,
                    letterSpacing: 0.5,
                    display: 'inline-block'
                  }}>
                    {aprLoading
                      ? '...'
                      : userApr !== null
                        ? Number(userApr).toFixed(2)
                        : Number(baseApr).toFixed(2)
                    }%
                  </span>
                </span>
              </div>
              <div>
                <b>Your Ranking:</b>
                <span className={styles.aprValue} style={{ color: '#000', background: 'none' }}>
                  {aprLoading
                    ? '...'
                    : userRank !== null
                      ? `#${userRank} of ${stakers.length} COLS stakers`
                      : 'N/A'}
                </span>
              </div>
            </div>
            {/* --- Simulation UI --- */}
            <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid #e0e0e0' }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Simulate COLS Staked</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={simulatedCols}
                  onChange={e => setSimulatedCols(e.target.value)}
                  style={{
                    width: 120,
                    padding: 6,
                    borderRadius: 4,
                    border: '1px solid #bbb',
                    fontSize: 15
                  }}
                  placeholder="Enter COLS"
                />
                <button
                  type="button"
                  onClick={handleSimulate}
                  style={{
                    background: '#ff9800',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 16px',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: 'pointer'
                  }}
                >
                  Apply
                </button>
              </div>
              {simError && (
                <div style={{ color: '#b71c1c', marginTop: 6, fontSize: 14 }}>{simError}</div>
              )}
              {simResult && (
                <div style={{ marginTop: 10, fontSize: 15 }}>
                  <div>
                    <b>Simulated Total APR:</b>{' '}
                    <span style={{ color: '#b71c1c', fontWeight: 700 }}>
                      {simResult.newApr !== null ? simResult.newApr.toFixed(2) + '%' : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <b>Simulated Ranking:</b>{' '}
                    <span style={{ color: '#b71c1c', fontWeight: 700 }}>
                      {simResult.newRank !== null ? `#${simResult.newRank} of ${stakers.length} COLS stakers` : 'N/A'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* --- End Simulation UI --- */}
          </div>
        </div>
      )}
      {/* Claim Rewards Panel */}
      {!isLoading && !isError && !isEmpty && (
        <div className={styles.panel}>
          <div className={styles.icon}>
            <MultiversX />
            <div style={{ background: '#27C180' }} className={styles.subicon}>
              <FontAwesomeIcon icon={faGift} />
            </div>
          </div>
          <div className={styles.title}>Claim Rewards</div>
          <div className={styles.actions}>
            <button
              type="button"
              style={{
                background: '#27C180',
                color: '#fff',
                fontWeight: 700,
                borderRadius: 7,
                padding: '15px 30px',
                border: 'none'
              }}
              className={classNames(styles.action)}
              disabled={pending}
              onClick={onClaimRewards(() => false)}
            >
              Claim eGLD Now
            </button>
            <button
              type="button"
              style={{
                background: '#27C180',
                color: '#fff',
                fontWeight: 700,
                borderRadius: 7,
                padding: '15px 30px',
                border: 'none'
              }}
              className={classNames(styles.action)}
              disabled={pending}
              onClick={onRedelegate(() => false)}
            >
              Redelegate eGLD
            </button>
            <ClaimCols onClaimed={() => {}} />
          </div>
        </div>
      )}
    </div>
  );
};
