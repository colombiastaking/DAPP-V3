import { useEffect, useState } from 'react';
import { faLock, faGift, faPercent } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import classNames from 'classnames';
import axios from 'axios';

import { MultiversX } from 'assets/MultiversX';
import { network, denomination } from 'config';
import { useGlobalContext } from 'context';

import { Delegate } from './components/Delegate';
import { Undelegate } from './components/Undelegate';
import { StakeCols } from './components/StakeCols';

import { useColsAprContext } from '../../context/ColsAprContext';

import styles from './styles.module.scss';
import { ClaimColsButton } from './ClaimColsButton';
import { ClaimEgldButton } from './ClaimEgldButton';
import useStakeData from './hooks';

// Format eGLD with max 3 decimals, converting from WEI (1e18) to EGLD
function formatEgld(amount: string | number) {
  const num = Number(amount);
  if (isNaN(num)) return amount;
  const egld = num / Math.pow(10, denomination);
  return egld.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// Format COLS with max 3 decimals, converting from WEI (1e18) to COLS
function formatCols(raw: string | number) {
  const num = Number(raw);
  if (isNaN(num)) return raw;
  const cols = num / 1e18;
  return cols.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

const ClaimCols = ({
  onClaimed
}: {
  onClaimed: () => void;
}) => {
  return <ClaimColsButton onClaimed={onClaimed} />;
};

async function fetchAprCols({
  serviceFee,
  baseApr,
  totalColsStaked
}: {
  serviceFee: number;
  baseApr: number;
  totalColsStaked: number;
}): Promise<number> {
  const AgencyBuyback = 0.4;
  const DAO_Coefficient = 0.333;

  let totalEgldLocked = 0;
  try {
    const { data } = await axios.get(
      `https://api.multiversx.com/providers/${network.delegationContract}`
    );
    if (data && typeof data.locked === 'string') {
      totalEgldLocked = Number(data.locked) / 1e18;
    }
  } catch {
    totalEgldLocked = 0;
  }

  let egldPrice = 0;
  try {
    const { data } = await axios.get(`${network.apiAddress}/economics`);
    egldPrice = Number(data.price);
  } catch {
    egldPrice = 0;
  }

  let colsPrice = 0;
  try {
    const { data } = await axios.get(
      'https://api.multiversx.com/mex/tokens/prices/hourly/COLS-9d91b7'
    );
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1];
      if (last && typeof last.value === 'number') {
        colsPrice = last.value;
      }
    }
  } catch {
    colsPrice = 0;
  }

  if (
    !totalEgldLocked ||
    !serviceFee ||
    !baseApr ||
    !egldPrice ||
    !colsPrice ||
    !totalColsStaked
  )
    return 0;
  const aprCols =
    totalEgldLocked *
    (baseApr / (1 - serviceFee)) *
    serviceFee *
    AgencyBuyback *
    DAO_Coefficient *
    (egldPrice / colsPrice) /
    totalColsStaked;

  return aprCols;
}

export const Stake = () => {
  const { address } = useGetAccountInfo();
  const { userActiveStake, userClaimableRewards, stakedCols } = useGlobalContext();
  const { onRedelegate } = useStakeData();

  const isLoading =
    userActiveStake.status === 'loading' ||
    userClaimableRewards.status === 'loading' ||
    stakedCols.status === 'loading';
  const isError =
    userActiveStake.status === 'error' ||
    userClaimableRewards.status === 'error' ||
    stakedCols.status === 'error';

  const hasEgldStaked = userActiveStake.data && userActiveStake.data !== '0';
  const hasColsStaked = stakedCols.data && stakedCols.data !== '0';

  const {
    loading: aprLoading,
    stakers,
    baseApr,
    egldPrice,
    colsPrice,
    agencyLockedEgld
  } = useColsAprContext();
  const [userApr, setUserApr] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    if (!address || !Array.isArray(stakers) || stakers.length === 0) {
      setUserApr(null);
      setUserRank(null);
      return;
    }
    const idx = stakers.findIndex((s: any) => s.address === address);
    if (idx === -1) {
      setUserApr(null);
      setUserRank(null);
    } else {
      setUserApr(stakers[idx].aprTotal ?? null);
      setUserRank(stakers[idx].rank ?? null);
    }
  }, [address, stakers]);

  const [simulatedCols, setSimulatedCols] = useState<string>('');
  const [simResult, setSimResult] = useState<{ newApr: number | null; newRank: number | null } | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // FIX: Use userActiveStake.data instead of stakers array for eGLD staked check
  let userEgldStaked = 0;
  if (userActiveStake && userActiveStake.data) {
    userEgldStaked = Number(userActiveStake.data);
  }

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

  const [aprCols, setAprCols] = useState<number | null>(null);
  const [aprColsLoading, setAprColsLoading] = useState(false);

  let totalColsStaked = 0;
  if (Array.isArray(stakers) && stakers.length > 0) {
    totalColsStaked = stakers.reduce(
      (sum: number, s: any) => sum + (s.colsStaked || 0),
      0
    );
  }

  useEffect(() => {
    if (
      !hasEgldStaked &&
      hasColsStaked &&
      typeof baseApr === 'number' &&
      !isNaN(baseApr) &&
      typeof serviceFee === 'number' &&
      !isNaN(serviceFee) &&
      totalColsStaked > 0
    ) {
      setAprColsLoading(true);
      fetchAprCols({ serviceFee, baseApr, totalColsStaked })
        .then(val => {
          setAprCols(val);
          setAprColsLoading(false);
        })
        .catch(() => {
          setAprCols(0);
          setAprColsLoading(false);
        });
    } else {
      setAprCols(null);
      setAprColsLoading(false);
    }
  }, [hasEgldStaked, hasColsStaked, baseApr, serviceFee, totalColsStaked]);

  if (isLoading) {
    return (
      <div className={classNames(styles.stake, styles.empty, 'stake')}>
        <div className={styles.wrapper}>
          <strong className={styles.heading}>
            Welcome to Colombia Staking Dashboard!
          </strong>
          <div className={styles.logo}>
            <MultiversX />
            <div style={{ background: '#6ee7c7' }} className={styles.subicon}>
              <FontAwesomeIcon icon={faLock} />
            </div>
          </div>
          <div className={styles.message}>
            Retrieving staking data...
          </div>
          <Delegate />
          <StakeCols />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={classNames(styles.stake, styles.empty, 'stake')}>
        <div className={styles.wrapper}>
          <strong className={styles.heading}>
            Welcome to Colombia Staking Dashboard!
          </strong>
          <div className={styles.logo}>
            <MultiversX />
            <div style={{ background: '#6ee7c7' }} className={styles.subicon}>
              <FontAwesomeIcon icon={faLock} />
            </div>
          </div>
          <div className={styles.message}>
            There was an error trying to retrieve staking data.
          </div>
          <Delegate />
          <StakeCols />
        </div>
      </div>
    );
  }

  if (!hasEgldStaked && hasColsStaked) {
    return (
      <div className={classNames(styles.stake, 'stake')}>
        <div className={styles.assetsRow}>
          <div className={styles.assetsBox}>
            <div className={styles.icon}>
              <MultiversX />
              <div style={{ background: '#6ee7c7' }} className={styles.subicon}>
                <span role="img" aria-label="fire" style={{ color: '#ff9800', fontSize: 20 }}>🔥</span>
              </div>
            </div>
            <div className={styles.title}>Active Assets</div>
            <div className={styles.activeAmountsRow}>
              <span className={styles.activeAmount}>
                <b>
                  {stakedCols.status === 'loaded'
                    ? formatCols(stakedCols.data || '0')
                    : '...'} COLS
                </b>
                <div className={styles.activeLabel}>staked</div>
              </span>
            </div>
            <div className={styles.actionsRow}>
              <div className={styles.actionButtonWrapper}><Delegate /></div>
              <div className={styles.actionButtonWrapper}><StakeCols /></div>
            </div>
          </div>
          <div
            className={styles.assetsBox}
            style={{
              borderColor: '#6ee7c7',
              background: 'linear-gradient(90deg, #6ee7c7 0%, #4f8cff 100%)',
              color: '#181a1b',
              minWidth: 220
            }}
          >
            <div className={styles.icon} style={{ background: '#fff' }}>
              <FontAwesomeIcon icon={faPercent} style={{ color: '#6ee7c7', fontSize: 32 }} />
            </div>
            <div className={styles.title} style={{ color: '#181a1b' }}>COLS APR</div>
            <div className={styles.aprInfo}>
              <div>
                <b>COLS APR:</b>
                <span className={styles.aprValue} style={{ color: '#181a1b', background: 'none' }}>
                  <span style={{
                    color: '#181a1b',
                    background: '#ffe082',
                    padding: '2px 12px',
                    borderRadius: 6,
                    fontWeight: 900,
                    fontSize: 20,
                    letterSpacing: 0.5,
                    display: 'inline-block',
                    boxShadow: '0 2px 8px #fff8'
                  }}>
                    {aprColsLoading
                      ? <span style={{ fontWeight: 400 }}>...</span>
                      : aprCols !== null
                        ? aprCols.toFixed(2)
                        : '0.00'
                    }%
                  </span>
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#181a1b', marginTop: 8 }}>
                Delegate some eGLD to boost your APR
              </div>
            </div>
          </div>
        </div>
        <div className={styles.panel}>
          <div className={styles.icon}>
            <MultiversX />
            <div style={{ background: '#6ee7c7' }} className={styles.subicon}>
              <FontAwesomeIcon icon={faGift} />
            </div>
          </div>
          <div className={styles.title}>Claim COLS Rewards</div>
          <div className={styles.actions}>
            <ClaimCols onClaimed={() => {}} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={classNames(
        styles.stake,
        { [styles.empty]: !hasEgldStaked && !hasColsStaked },
        'stake'
      )}
    >
      <div className={styles.assetsRow}>
        <div className={styles.assetsBox}>
          <div className={styles.icon}>
            <MultiversX />
            <div style={{ background: '#6ee7c7' }} className={styles.subicon}>
              <span role="img" aria-label="fire" style={{ color: '#ff9800', fontSize: 20 }}>🔥</span>
            </div>
          </div>
          <div className={styles.title}>Active Assets</div>
          <div className={styles.activeAmountsRow}>
            <span className={styles.activeAmount}>
              <b>
                {userActiveStake.status === 'loaded'
                  ? formatEgld(userActiveStake.data || '...')
                  : '...'} {network.egldLabel}
              </b>
              <div className={styles.activeLabel}>delegated</div>
            </span>
            <span className={styles.activeAmount}>
              <b>
                {stakedCols.status === 'loaded'
                  ? formatCols(stakedCols.data || '0')
                  : '...'} COLS
              </b>
              <div className={styles.activeLabel}>staked</div>
            </span>
          </div>
          <div className={styles.actionsRow}>
            <div className={styles.actionButtonWrapper}><Delegate /></div>
            <div className={styles.actionButtonWrapper}><StakeCols /></div>
            <div className={styles.actionButtonWrapper}><Undelegate /></div>
          </div>
        </div>
        <div
          className={styles.assetsBox}
          style={{
            borderColor: '#6ee7c7',
            background: 'linear-gradient(90deg, #6ee7c7 0%, #4f8cff 100%)',
            color: '#181a1b',
            minWidth: 220
          }}
        >
          <div className={styles.icon} style={{ background: '#fff' }}>
            <FontAwesomeIcon icon={faPercent} style={{ color: '#6ee7c7', fontSize: 32 }} />
          </div>
          <div className={styles.title} style={{ color: '#181a1b' }}>APR for your eGLD</div>
          <div className={styles.aprInfo}>
            <div>
              <b>Base APR:</b>
              <span className={styles.aprValue} style={{ color: '#181a1b', background: 'none' }}>
                {aprLoading ? '...' : Number(baseApr).toFixed(2)}%
              </span>
            </div>
            <div>
              <b>Total APR with Bonus:</b>
              <span
                className={styles.aprValue}
                style={{
                  color: '#181a1b',
                  fontWeight: 700,
                  background: 'none',
                  textShadow: '0 1px 8px #fff8'
                }}
              >
                <span style={{
                  color: '#181a1b',
                  background: '#ffe082',
                  padding: '2px 12px',
                  borderRadius: 6,
                  fontWeight: 900,
                  fontSize: 20,
                  letterSpacing: 0.5,
                  display: 'inline-block',
                  boxShadow: '0 2px 8px #fff8'
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
              <span className={styles.aprValue} style={{ color: '#181a1b', background: 'none' }}>
                <span style={{
                  color: '#fff',
                  background: '#1976d2',
                  padding: '2px 12px',
                  borderRadius: 6,
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: 0.5,
                  display: 'inline-block',
                  boxShadow: '0 2px 8px #fff8'
                }}>
                  {aprLoading
                    ? '...'
                    : userRank !== null
                      ? `#${userRank} of ${stakers.length} COLS stakers`
                      : 'N/A'}
                </span>
              </span>
            </div>
          </div>
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid #e0e0e0' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Simulate COLS Staked</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min={0}
                max={40000}
                step="any"
                value={simulatedCols}
                onChange={e => {
                  let val = e.target.value;
                  if (val === '') {
                    setSimulatedCols('');
                    setSimError(null);
                    return;
                  }
                  if (parseFloat(val) > 40000) {
                    setSimulatedCols('40000');
                    setSimError('Maximum COLS to simulate is 40,000');
                  } else {
                    setSimulatedCols(val);
                    setSimError(null);
                  }
                }}
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
                onClick={async () => {
                  setSimError(null);
                  setSimResult(null);
                  setSimLoading(true);
                  if (!address) {
                    setSimError('Not logged in');
                    setSimLoading(false);
                    return;
                  }
                  // FIX: Use userEgldStaked from userActiveStake.data
                  if (!userEgldStaked || userEgldStaked <= 0) {
                    setSimError('You must have eGLD staked to simulate');
                    setSimLoading(false);
                    return;
                  }
                  let val = 0;
                  try {
                    val = parseFloat(simulatedCols);
                    if (isNaN(val) || val < 0) throw new Error();
                    if (val > 40000) {
                      setSimError('Maximum COLS to simulate is 40,000');
                      setSimLoading(false);
                      return;
                    }
                  } catch {
                    setSimError('Invalid COLS value');
                    setSimLoading(false);
                    return;
                  }
                  let lockedEgld = agencyLockedEgld;
                  try {
                    lockedEgld = await axios.get(
                      `https://api.multiversx.com/providers/${network.delegationContract}`
                    ).then(res => {
                      if (res.data && typeof res.data.locked === 'string') {
                        return Math.round((Number(res.data.locked) / 1e18) * 10000) / 10000;
                      }
                      return agencyLockedEgld;
                    });
                  } catch {}
                  const APRmin = 0.01;
                  const APRmax = 15;
                  const AGENCY_BUYBACK = 0.4;
                  const DAO_DISTRIBUTION_RATIO = 0.333;
                  const newStakers = stakers.map((s: any) =>
                    s.address === address
                      ? { ...s, colsStaked: val }
                      : s
                  );
                  for (const row of newStakers) {
                    if (row.egldStaked > 0 && colsPrice > 0 && egldPrice > 0) {
                      row.ratio = (row.colsStaked * colsPrice) / (row.egldStaked * egldPrice);
                    } else {
                      row.ratio = null;
                    }
                  }
                  const validRatios = newStakers.filter((r: any) => r.ratio !== null).map((r: any) => r.ratio);
                  const minRatio = validRatios.length > 0 ? Math.min(...validRatios) : 0;
                  const maxRatio = validRatios.length > 0 ? Math.max(...validRatios) : 0;
                  for (const row of newStakers) {
                    if (row.ratio !== null && maxRatio !== minRatio) {
                      row.normalized = (row.ratio - minRatio) / (maxRatio - minRatio);
                    } else {
                      row.normalized = null;
                    }
                  }
                  for (const row of newStakers) {
                    if (row.normalized !== null) {
                      row.aprBonus = APRmin + (APRmax - APRmin) * Math.sqrt(row.normalized);
                    } else {
                      row.aprBonus = null;
                    }
                  }
                  const totalEgldStaked = lockedEgld;
                  const sumColsStaked = newStakers.reduce(
                    (sum: number, r: any) => sum + (r.colsStaked || 0),
                    0
                  );
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
                  for (const row of newStakers) {
                    if (row.egldStaked > 0) {
                      row.aprTotal = baseApr + (row.aprBonus || 0) + (row.dao || 0);
                    } else {
                      row.aprTotal = baseApr;
                    }
                  }
                  const sorted = [...newStakers].sort((a: any, b: any) => (b.aprTotal || 0) - (a.aprTotal || 0));
                  for (let i = 0; i < sorted.length; ++i) {
                    sorted[i].rank = i + 1;
                  }
                  for (const row of newStakers) {
                    const found = sorted.find((r: any) => r.address === row.address);
                    row.rank = found ? found.rank : null;
                  }
                  const user = newStakers.find((s: any) => s.address === address);
                  setSimResult({
                    newApr: user && user.aprTotal ? user.aprTotal : null,
                    newRank: user && user.rank ? user.rank : null
                  });
                  setSimLoading(false);
                }}
                style={{
                  background: '#6ee7c7',
                  color: '#181a1b',
                  border: 'none',
                  borderRadius: 4,
                  padding: '6px 16px',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px #6ee7c7aa'
                }}
                disabled={simLoading}
              >
                {simLoading ? 'Calculating...' : 'Apply'}
              </button>
            </div>
            {simError && (
              <div style={{ color: '#b71c1c', marginTop: 6, fontSize: 14 }}>{simError}</div>
            )}
            {simResult && (
              <div style={{ marginTop: 10, fontSize: 15 }}>
                <div>
                  <b>Simulated Total APR:</b>{' '}
                  <span style={{
                    color: '#181a1b',
                    background: '#ffe082',
                    padding: '2px 12px',
                    borderRadius: 6,
                    fontWeight: 900,
                    fontSize: 20,
                    letterSpacing: 0.5,
                    display: 'inline-block',
                    boxShadow: '0 2px 8px #fff8'
                  }}>
                    {simResult.newApr !== null ? simResult.newApr.toFixed(2) + '%' : 'N/A'}
                  </span>
                </div>
                <div>
                  <b>Simulated Ranking:</b>{' '}
                  <span style={{
                    color: '#fff',
                    background: '#1976d2',
                    padding: '2px 12px',
                    borderRadius: 6,
                    fontWeight: 900,
                    fontSize: 18,
                    letterSpacing: 0.5,
                    display: 'inline-block',
                    boxShadow: '0 2px 8px #fff8'
                  }}>
                    {simResult.newRank !== null ? `#${simResult.newRank} of ${stakers.length} COLS stakers` : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.icon}>
          <MultiversX />
          <div style={{ background: '#6ee7c7' }} className={styles.subicon}>
            <FontAwesomeIcon icon={faGift} />
          </div>
        </div>
        <div className={styles.title}>Claim Rewards</div>
        <div className={styles.actions}>
          <ClaimEgldButton onClaimed={() => {}} />
          <button
            type="button"
            style={{
              background: '#6ee7c7',
              color: '#181a1b',
              fontWeight: 700,
              borderRadius: 7,
              padding: '15px 30px',
              border: 'none',
              marginRight: 0,
              marginBottom: 0,
              fontSize: 16,
              boxShadow: '0 2px 8px #6ee7c7aa'
            }}
            className={classNames(styles.action)}
            onClick={onRedelegate(() => false)}
          >
            Redelegate eGLD
          </button>
          <ClaimCols onClaimed={() => {}} />
        </div>
      </div>
    </div>
  );
};
