import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { faPercent } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import classNames from 'classnames';

import { MultiversX } from 'assets/MultiversX';
import { network, denomination } from 'config';
import { useGlobalContext } from 'context';

import { Delegate } from './components/Delegate';
import { Undelegate } from './components/Undelegate';
import { StakeCols } from './components/StakeCols';

import { useColsAprContext } from '../../context/ColsAprContext';

import styles from './styles.module.scss';

// --- Universal HelpIcon using React portal ---
function HelpIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState<{top: number, left: number}>({top: 0, left: 0});
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX + 24
      });
    }
  }, [show]);

  return (
    <>
      <span
        ref={iconRef}
        style={{
          display: 'inline-block',
          position: 'relative',
          marginLeft: 4,
          cursor: 'pointer',
          verticalAlign: 'middle',
          zIndex: 100
        }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onTouchStart={() => setShow((v) => !v)}
        tabIndex={0}
        aria-label="Help"
      >
        <span style={{
          display: 'inline-block',
          width: 18,
          height: 18,
          background: '#6ee7c7',
          color: '#181a1b',
          borderRadius: '50%',
          textAlign: 'center',
          fontWeight: 900,
          fontSize: 14,
          lineHeight: '18px',
          boxShadow: '0 1px 4px #6ee7c7aa',
          userSelect: 'none'
        }}>?</span>
      </span>
      {show && createPortal(
        <span style={{
          position: 'absolute',
          left: coords.left,
          top: coords.top,
          background: '#23272a',
          color: '#ffe082',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 14,
          fontWeight: 500,
          boxShadow: '0 2px 8px #000a',
          zIndex: 9999,
          minWidth: 180,
          maxWidth: 320,
          whiteSpace: 'pre-line',
          pointerEvents: 'none'
        }}>{text}</span>,
        document.body
      )}
    </>
  );
}

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

export const Stake = () => {
  const { address } = useGetAccountInfo();
  const { userActiveStake, stakedCols } = useGlobalContext();

  const hasEgldStaked = userActiveStake.data && userActiveStake.data !== '0';
  const hasColsStaked = stakedCols.data && stakedCols.data !== '0';

  const {
    loading: aprLoading,
    stakers,
    baseApr
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
          <div className={styles.title} style={{ color: '#181a1b' }}>
            APR for your eGLD
            <HelpIcon text={
              "APR (Annual Percentage Rate) is your yearly yield. It is based on:\n- The base APR (set by the protocol)\n- Your COLS/eGLD ratio (the more COLS you stake relative to your eGLD, the higher your bonus)\n- DAO rewards (distributed to COLS stakers)\n\nAPR can increase if you stake more COLS relative to your eGLD."
            } />
          </div>
          <div className={styles.aprInfo}>
            <div>
              <b>Base APR:</b>
              <span className={styles.aprValue} style={{ color: '#181a1b', background: 'none' }}>
                {aprLoading ? '...' : Number(baseApr).toFixed(2)}%
              </span>
              <HelpIcon text="Base APR is the standard annual percentage rate for all delegators, before any COLS bonus." />
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
              <HelpIcon text={
                "Total APR includes your COLS bonus and DAO rewards. The more COLS you stake relative to your eGLD, the higher your bonus. DAO rewards are distributed to COLS stakers."
              } />
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
              <HelpIcon text={
                "Ranking is based on your total APR compared to other stakers. The more COLS you stake (relative to your eGLD), the higher your rank."
              } />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
