import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import axios from 'axios';
import classNames from 'classnames';
import { network } from 'config';
import { useColsAprContext } from '../../context/ColsAprContext';
import { useGlobalContext } from '../../context';
import styles from './NewDelegatorBenefit.module.scss';

function formatEgld(amount: string | number) {
  const num = Number(amount);
  if (isNaN(num)) return amount;
  return (num / 1e18).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
function formatCols(amount: string | number) {
  const num = Number(amount);
  if (isNaN(num)) return amount;
  return (num / 1e18).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

// Universal HelpIcon using React portal for tooltips
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

function ContactClaimButton({ disabled, selectedProviders, totalEgld, userAddress, onClose }: {
  disabled: boolean,
  selectedProviders: any[],
  totalEgld: number,
  userAddress: string,
  onClose?: () => void
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const providerNames = selectedProviders.map(p => p.name).join(', ');
  const userMsg = `Hello, I would like to claim the 10-Day Migration Benefit.\nMy wallet address is: ${userAddress}\nI migrated ${formatEgld(totalEgld)} eGLD from: ${providerNames}.`;
  const mailto = `mailto:colombiastaking@gmail.com?subject=10-Day%20Migration%20Benefit%20Claim&body=${encodeURIComponent(userMsg)}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(userMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className={styles.claimBtn}
        disabled={disabled}
        onClick={() => setShowOptions((v) => !v)}
        style={{ minWidth: 220 }}
      >
        <span role="img" aria-label="gift">🎁</span> Contact to Claim 10-Day Reward
      </button>
      {showOptions && (
        <div className={styles.contactOptions}>
          <div className={styles.contactTitle}>Contact Colombia Staking:</div>
          <ul>
            <li>
              <a href="https://t.me/ColombiaStaking" target="_blank" rel="noopener noreferrer">
                <span role="img" aria-label="telegram">💬</span> Telegram (send a private message)
              </a>
              <button className={styles.copyBtn} onClick={handleCopy} style={{marginLeft:8}}>
                {copied ? "Copied!" : "Copy Message"}
              </button>
            </li>
            <li>
              <a href="https://x.com/ColombiaStaking" target="_blank" rel="noopener noreferrer">
                <span role="img" aria-label="x">𝕏</span> X (Twitter) (send a private message)
              </a>
              <button className={styles.copyBtn} onClick={handleCopy} style={{marginLeft:8}}>
                {copied ? "Copied!" : "Copy Message"}
              </button>
            </li>
            <li>
              <a href={mailto}>
                <span role="img" aria-label="email">✉️</span> Email (colombiastaking@gmail.com)
              </a>
            </li>
          </ul>
          <div className={styles.contactNote}>
            <b>Instructions:</b> Please send a private message or email with your wallet address and the provider(s) you migrated from.<br />
            <b>Payment will be made after you delegate your eGLD to Colombia Staking.</b>
            <div style={{marginTop:8, background:'#181a1b', borderRadius:6, padding:8, fontSize:13}}>
              <b>Message to send:</b>
              <pre style={{whiteSpace:'pre-wrap', background:'#23272a', color:'#ffe082', borderRadius:4, padding:8, marginTop:4, fontSize:13}}>{userMsg}</pre>
            </div>
          </div>
          <button className={styles.closeContact} onClick={() => { setShowOptions(false); onClose && onClose(); }}>Close</button>
        </div>
      )}
    </div>
  );
}

export function DashboardNewDelegator() {
  const { address } = useGetAccountInfo();
  const { stakedCols } = useGlobalContext();
  const [loading, setLoading] = useState(true);
  const [providerMap, setProviderMap] = useState<Record<string, string>>({});
  const [userDelegations, setUserDelegations] = useState<any[]>([]);
  const [colombiaStaked, setColombiaStaked] = useState('0');
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [status, setStatus] = useState<'none'|'undelegating'|'eligible'|'completed'>('none');
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);

  const { baseApr, colsPrice, egldPrice } = useColsAprContext();

  // Fetch all providers and user delegations
  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      axios.get('https://api.multiversx.com/providers?type=staking'),
      axios.get(`https://api.multiversx.com/accounts/${address}/delegation`)
    ]).then(([provRes, delRes]) => {
      // Build provider address => identity map
      const map: Record<string, string> = {};
      for (const p of provRes.data || []) {
        map[p.provider] = p.identity || p.provider;
      }
      setProviderMap(map);
      setUserDelegations(delRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
    // Fetch user's staked eGLD with Colombia
    axios.get(`https://api.multiversx.com/accounts/${address}/delegation/${network.delegationContract}`)
      .then(res => setColombiaStaked(res.data?.userActiveStake || '0'))
      .catch(() => setColombiaStaked('0'));
    // Fetch pending withdrawals (to check if user has unstaked from provider)
    axios.get(`https://api.multiversx.com/accounts/${address}/withdrawals`)
      .then(res => setPendingWithdrawals(res.data || []))
      .catch(() => setPendingWithdrawals([]));
  }, [address]);

  // Filter out Colombia Staking from userDelegations
  const otherDelegations = userDelegations.filter((d: any) =>
    d.contract !== network.delegationContract && Number(d.userActiveStake) > 0
  );

  // Multi-select logic (button system)
  const selectedProviders = otherDelegations
    .filter((d: any) => selectedContracts.includes(d.contract))
    .map((d: any) => ({
      ...d,
      name: providerMap[d.contract] || d.contract
    }));

  const totalEgldToMigrate = selectedProviders.reduce((sum, d) => sum + Number(d.userActiveStake), 0);

  // Required COLS: must have 1 COLS per eGLD to be migrated, in addition to what is already required for Colombia Staking
  const currentColombiaEgld = Number(colombiaStaked);
  const totalColsStaked = Number(stakedCols?.data || 0);
  const requiredCols = currentColombiaEgld + totalEgldToMigrate;
  const hasEnoughCols = totalColsStaked >= requiredCols;
  const missingCols = hasEnoughCols ? 0 : requiredCols - totalColsStaked;

  // Status logic
  useEffect(() => {
    if (selectedProviders.length === 0) { setStatus('none'); return; }
    if (currentColombiaEgld > 0 && currentColombiaEgld >= totalEgldToMigrate) {
      setStatus('completed');
    } else if (hasEnoughCols && selectedProviders.every(
      (sp) => pendingWithdrawals.some(
        (w) => w.contract === sp.contract && Number(w.userAmount) > 0
      )
    )) {
      setStatus('eligible');
    } else if (hasEnoughCols) {
      setStatus('undelegating');
    } else {
      setStatus('none');
    }
  }, [selectedProviders, currentColombiaEgld, totalColsStaked, totalEgldToMigrate, pendingWithdrawals, hasEnoughCols]);

  // Calculate 10-day APR reward in COLS
  const apr10d = baseApr && egldPrice && colsPrice && totalEgldToMigrate
    ? ((totalEgldToMigrate / 1e18) * (baseApr/100) * (10/365) * egldPrice / colsPrice).toFixed(3)
    : '0';

  if (loading) return <div className={styles.centered}><div className={styles.loading}>Loading...</div></div>;

  return (
    <div className={styles.centered}>
      <div className={styles.benefitBox}>
        <h3 className={styles.sectionTitle}>
          10 days Migration Benefit
          <HelpIcon text={
            "If you move your eGLD from one or more other providers to Colombia Staking and stake the same amount of COLS, you can claim a 10-day APR reward in COLS.\n\nYou must have 1 COLS staked for every 1 eGLD you want to migrate, in addition to your current Colombia Staking delegation.\n\nExample: If you have 1250 eGLD and 1250 COLS staked at Colombia Staking, and want to migrate 50 eGLD from other providers, you must stake 50 additional COLS (total 1300 COLS) to be eligible."
          } />
        </h3>
        <div className={styles.section}>
          <div className={styles.rowLabel}>
            Your eGLD Staked with Other Providers
            <HelpIcon text="These are your current eGLD delegations with other providers. Select one or more to start the migration process." />
          </div>
          {otherDelegations.length === 0 && (
            <div>No eGLD staked with other providers.</div>
          )}
          <div className={styles.providersButtonList}>
            {otherDelegations.map((d: any) => {
              const providerName = providerMap[d.contract] || d.contract;
              const isSelected = selectedContracts.includes(d.contract);
              const requiredColsForThis = currentColombiaEgld + Number(d.userActiveStake);
              const hasEnoughColsForThis = totalColsStaked >= requiredColsForThis;
              const missingColsForThis = hasEnoughColsForThis ? 0 : requiredColsForThis - totalColsStaked;
              return (
                <button
                  key={d.contract}
                  className={classNames(styles.providerBtn, { [styles.selectedBtn]: isSelected })}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedContracts(prev => prev.filter(c => c !== d.contract));
                    } else {
                      setSelectedContracts(prev => [...prev, d.contract]);
                    }
                  }}
                  type="button"
                >
                  <div>
                    <b>{providerName}</b>
                  </div>
                  <div>
                    <span>Staked: {formatEgld(d.userActiveStake)} EGLD</span>
                  </div>
                  {isSelected && (
                    <div className={styles.providerBtnActions}>
                      <a href={`https://explorer.multiversx.com/accounts/${d.contract}`} target="_blank" rel="noopener noreferrer">View</a>
                      {hasEnoughColsForThis && (
                        <button
                          className={styles.undelegateBtn}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            window.open(`https://wallet.multiversx.com/delegation/${d.contract}`, '_blank');
                          }}
                        >
                          Undelegate
                        </button>
                      )}
                      <HelpIcon text={
                        hasEnoughColsForThis
                          ? "Click to undelegate from this provider."
                          : "You need to stake enough COLS before you can undelegate from this provider. (You need at least your current Colombia eGLD + this provider's eGLD in COLS staked.)"
                      } />
                      {!hasEnoughColsForThis && (
                        <div className={styles.missingCols}>
                          <span>
                            <b>Missing COLS:</b> {formatCols(missingColsForThis)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {selectedProviders.length > 0 && (
          <div className={styles.section}>
            <div className={styles.rowLabel}>
              Step 2: Stake COLS
              <HelpIcon text="You must have 1 COLS staked for every 1 eGLD you want to migrate, in addition to your current Colombia Staking delegation. The required COLS is: (your current Colombia eGLD + total eGLD to migrate)." />
            </div>
            <div>
              <label>
                Required COLS to stake:&nbsp;
                <input
                  type="number"
                  min={0}
                  value={Number(requiredCols)/1e18}
                  readOnly
                  style={{width:100}}
                /> COLS
              </label>
              <HelpIcon text={
                hasEnoughCols
                  ? "You have enough COLS staked to be eligible for the 10 days benefit."
                  : "You need to stake more COLS to be eligible. Stake at least as many COLS as your current Colombia eGLD plus the eGLD you want to migrate."
              } />
            </div>
            {!hasEnoughCols && (
              <div className={styles.missingCols}>
                <span>
                  <b>Missing COLS:</b> {formatCols(missingCols)}
                </span>
                <button
                  className={styles.stakeBtn}
                  onClick={() => window.open('https://app.multiversx.com/tokens/COLS-9d91b7', '_blank')}
                  disabled={hasEnoughCols}
                >
                  Stake {formatCols(missingCols > 0 ? missingCols : requiredCols)} COLS
                </button>
                <HelpIcon text="Stake COLS tokens here. You must have at least the required amount staked before you can claim the reward or undelegate from the other provider." />
              </div>
            )}
            {hasEnoughCols && (
              <div style={{ color: '#6ee7c7', fontWeight: 600, marginTop: 8 }}>
                You have enough COLS staked to migrate the selected eGLD.
              </div>
            )}
            <div style={{marginTop:12}}>
              <b>10-day APR Reward (in COLS):</b> {apr10d}
              <HelpIcon text="This is the amount of COLS you will receive as a reward for moving your eGLD and staking COLS." />
            </div>
            <div style={{marginTop:12}}>
              <b>Status:</b> {status === 'none' && 'Select provider(s) and stake COLS'}
              {status === 'undelegating' && 'Waiting for undelegation...'}
              {status === 'eligible' && 'Eligible! You can now claim your reward.'}
              {status === 'completed' && 'Completed! You will receive your reward soon.'}
              <HelpIcon text="You can only claim the reward after you have staked the required COLS and completed the undelegation from your previous provider(s)." />
            </div>
            <div style={{marginTop:18}}>
              <ContactClaimButton
                disabled={!(status === 'eligible')}
                selectedProviders={selectedProviders}
                totalEgld={totalEgldToMigrate}
                userAddress={address}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
