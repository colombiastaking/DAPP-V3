import { useEffect, useState } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import axios from 'axios';
import classNames from 'classnames';
import { network } from 'config';
import { useColsAprContext } from '../../context/ColsAprContext';
import { useGlobalContext } from '../../context';
import { Formik } from 'formik';
import { object, string } from 'yup';
import BigNumber from 'bignumber.js';
import { Modal } from 'react-bootstrap';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';
import { HelpIcon } from 'components/HelpIcon';
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

function UndelegateModal({
  show,
  onClose,
  providerName,
  contract,
  maxAmount,
  egldLabel
}: {
  show: boolean,
  onClose: () => void,
  providerName: string,
  contract: string,
  maxAmount: string,
  egldLabel: string
}) {
  const [pending, setPending] = useState(false);
  return (
    <Modal show={show} onHide={onClose} centered animation={false}>
      <div style={{ padding: 32, textAlign: 'center', background: '#242526', borderRadius: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12, color: '#6ee7c7' }}>
          Undelegate from {providerName}
        </div>
        <Formik
          validationSchema={object().shape({
            amount: string()
              .required('Required')
              .test('min', 'Value must be greater than zero.', (value = '0') =>
                new BigNumber(value).isGreaterThan(0)
              )
              .test('max', `You can undelegate up to ${formatEgld(maxAmount)} ${egldLabel}.`, (value = '0') =>
                new BigNumber(value).lte(new BigNumber(maxAmount).dividedBy(1e18))
              )
          })}
          onSubmit={async ({ amount }) => {
            setPending(true);
            try {
              let hexAmount = new BigNumber(amount).multipliedBy(1e18).toString(16);
              if (hexAmount.length % 2 === 1) hexAmount = '0' + hexAmount;
              await sendTransactions({
                transactions: [
                  {
                    value: '0',
                    data: `unDelegate@${hexAmount}`,
                    receiver: contract,
                    gasLimit: 12000000
                  }
                ]
              });
              setPending(false);
              onClose();
            } catch {
              setPending(false);
            }
          }}
          initialValues={{
            amount: new BigNumber(maxAmount).dividedBy(1e18).toString()
          }}
        >
          {({ values, errors, touched, handleChange, handleBlur, handleSubmit, setFieldValue }) => (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label>
                  Amount to undelegate ({egldLabel}):&nbsp;
                  <input
                    type="number"
                    name="amount"
                    min={0}
                    max={new BigNumber(maxAmount).dividedBy(1e18).toString()}
                    value={values.amount}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    style={{ width: 120, borderRadius: 6, border: '1px solid #bbb', padding: 6, fontSize: 15 }}
                  />
                </label>
                <button
                  type="button"
                  style={{
                    marginLeft: 8,
                    background: '#303234',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 16px',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: 'pointer'
                  }}
                  onClick={() => setFieldValue('amount', new BigNumber(maxAmount).dividedBy(1e18).toString())}
                >
                  Max
                </button>
              </div>
              {errors.amount && touched.amount && (
                <div style={{ color: '#f53855', marginBottom: 8 }}>{errors.amount}</div>
              )}
              <div style={{ marginTop: 18 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: '#303234',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 24px',
                    fontSize: 15,
                    marginRight: 8
                  }}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#6ee7c7',
                    color: '#181a1b',
                    border: 'none',
                    borderRadius: 6,
                    padding: '10px 24px',
                    fontSize: 15,
                    fontWeight: 700
                  }}
                  disabled={pending}
                >
                  {pending ? 'Processing...' : 'Sign Transaction'}
                </button>
              </div>
            </form>
          )}
        </Formik>
      </div>
    </Modal>
  );
}

export function DashboardNewDelegator() {
  const { address } = useGetAccountInfo();
  const { stakedCols } = useGlobalContext();
  const [loading, setLoading] = useState(true);
  const [, setProviderMap] = useState<Record<string, string>>({});
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [colombiaStaked, setColombiaStaked] = useState('0');
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [status, setStatus] = useState<'none'|'undelegating'|'eligible'|'completed'>('none');
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [undelegateModal, setUndelegateModal] = useState<{contract: string, providerName: string, maxAmount: string} | null>(null);

  const { baseApr, colsPrice, egldPrice } = useColsAprContext();

  // Fetch all providers, user delegations, and waiting (unbonding) delegations
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [provRes, delRes, colRes, wdRes] = await Promise.all([
        axios.get('https://api.multiversx.com/providers?type=staking'),
        axios.get(`https://api.multiversx.com/accounts/${address}/delegation`),
        axios.get(`https://api.multiversx.com/accounts/${address}/delegation/${network.delegationContract}`),
        axios.get(`https://api.multiversx.com/accounts/${address}/withdrawals`)
      ]);
      const map: Record<string, string> = {};
      for (const p of provRes.data || []) {
        map[p.provider] = p.identity || p.provider;
      }
      setProviderMap(map);

      // Build allProviders: for each provider, show active stake and/or waiting (unbonding) eGLD
      const providers: any[] = [];
      (delRes.data || []).forEach((d: any) => {
        // Active stake
        if (d.contract !== network.delegationContract && Number(d.userActiveStake) > 0) {
          providers.push({
            contract: d.contract,
            userActiveStake: d.userActiveStake,
            waiting: false,
            waitingAmount: '0',
            providerName: map[d.contract] || d.contract
          });
        }
        // Waiting (unbonding) eGLD
        if (d.contract !== network.delegationContract && Array.isArray(d.userUndelegatedList)) {
          d.userUndelegatedList.forEach((u: any, idx: number) => {
            if (Number(u.amount) > 0) {
              providers.push({
                contract: d.contract,
                userActiveStake: '0',
                waiting: true,
                waitingAmount: u.amount,
                providerName: map[d.contract] || d.contract,
                timeLeft: u.seconds,
                key: d.contract + '-waiting-' + idx
              });
            }
          });
        }
      });
      setAllProviders(providers);
      setColombiaStaked(colRes.data?.userActiveStake || '0');
      setPendingWithdrawals(wdRes.data || []);
    } catch {
      // handle error if needed
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!address) return;
    fetchAllData();
    // eslint-disable-next-line
  }, [address]);

  const totalColsStaked = Number(stakedCols?.data || 0);

  // Multi-select logic (button system)
  const selectedProviders = allProviders
    .filter((d: any) => selectedContracts.includes(d.contract + (d.waiting ? '-waiting-' + (d.key?.split('-waiting-')[1] || 0) : '')))
    .map((d: any) => ({
      ...d,
      name: d.providerName
    }));

  // For migration, sum both active and waiting eGLD
  const totalEgldToMigrate = selectedProviders.reduce(
    (sum, d) =>
      sum +
      (d.waiting
        ? Number(d.waitingAmount)
        : Number(d.userActiveStake)),
    0
  );

  const currentColombiaEgld = Number(colombiaStaked);
  const requiredCols = currentColombiaEgld + totalEgldToMigrate;
  const hasEnoughCols = totalColsStaked >= requiredCols;
  const missingCols = hasEnoughCols ? 0 : requiredCols - totalColsStaked;

  useEffect(() => {
    if (selectedProviders.length === 0) { setStatus('none'); return; }
    if (currentColombiaEgld > 0 && currentColombiaEgld >= totalEgldToMigrate) {
      setStatus('completed');
    } else if (
      hasEnoughCols &&
      selectedProviders.every(
        (sp) =>
          sp.waiting ||
          pendingWithdrawals.some(
            (w) => w.contract === sp.contract && Number(w.userAmount) > 0
          )
      )
    ) {
      setStatus('eligible');
    } else if (hasEnoughCols) {
      setStatus('undelegating');
    } else {
      setStatus('none');
    }
  }, [
    selectedProviders,
    currentColombiaEgld,
    totalColsStaked,
    totalEgldToMigrate,
    pendingWithdrawals,
    hasEnoughCols
  ]);

  const apr10d =
    baseApr && egldPrice && colsPrice && totalEgldToMigrate
      ? (
          (totalEgldToMigrate / 1e18) *
          (baseApr / 100) *
          (10 / 365) *
          egldPrice /
          colsPrice
        ).toFixed(3)
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
            <HelpIcon text="These are your current eGLD delegations with other providers. Select one or more to start the migration process. If you have eGLD in the waiting period (unbonding), it will also appear here." />
          </div>
          {allProviders.length === 0 && (
            <div>No eGLD staked or waiting with other providers.</div>
          )}
          <div className={styles.providersButtonList}>
            {allProviders.map((d: any, idx: number) => {
              const providerName = d.providerName;
              const key = d.contract + (d.waiting ? '-waiting-' + idx : '');
              const isSelected = selectedContracts.includes(key);
              const requiredColsForThis =
                currentColombiaEgld +
                (d.waiting ? Number(d.waitingAmount) : Number(d.userActiveStake));
              const hasEnoughColsForThis = totalColsStaked >= requiredColsForThis;
              const missingColsForThis = hasEnoughColsForThis
                ? 0
                : requiredColsForThis - totalColsStaked;
              return (
                <button
                  key={key}
                  className={classNames(styles.providerBtn, {
                    [styles.selectedBtn]: isSelected
                  })}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedContracts((prev) =>
                        prev.filter((c) => c !== key)
                      );
                    } else {
                      setSelectedContracts((prev) => [...prev, key]);
                    }
                  }}
                  type="button"
                >
                  <div>
                    <b>{providerName}</b>
                  </div>
                  <div>
                    {d.waiting ? (
                      <span>
                        Waiting: {formatEgld(d.waitingAmount)} EGLD
                        <span style={{ color: '#ffe082', marginLeft: 8 }}>
                          (in unbonding period, available in {Math.ceil(Number(d.timeLeft) / 3600)}h)
                        </span>
                      </span>
                    ) : (
                      <span>Staked: {formatEgld(d.userActiveStake)} EGLD</span>
                    )}
                  </div>
                  {isSelected && (
                    <div className={styles.providerBtnActions}>
                      <a
                        href={`https://explorer.multiversx.com/accounts/${d.contract}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View
                      </a>
                      {!d.waiting && hasEnoughColsForThis && (
                        <button
                          className={styles.undelegateBtn}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUndelegateModal({
                              contract: d.contract,
                              providerName,
                              maxAmount: d.userActiveStake
                            });
                          }}
                        >
                          Undelegate
                        </button>
                      )}
                      <HelpIcon
                        text={
                          d.waiting
                            ? "This eGLD is in the waiting period (unbonding) and will be available to withdraw soon."
                            : hasEnoughColsForThis
                            ? "Click to undelegate from this provider."
                            : "You need to stake enough COLS before you can undelegate from this provider. (You need at least your current Colombia eGLD + this provider's eGLD in COLS staked.)"
                        }
                      />
                      {!hasEnoughColsForThis && !d.waiting && (
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
                  value={Number(requiredCols) / 1e18}
                  readOnly
                  style={{ width: 100 }}
                />{' '}
                COLS
              </label>
              <HelpIcon
                text={
                  hasEnoughCols
                    ? 'You have enough COLS staked to be eligible for the 10 days benefit.'
                    : 'You need to stake more COLS to be eligible. Stake at least as many COLS as your current Colombia eGLD plus the eGLD you want to migrate.'
                }
              />
            </div>
            {!hasEnoughCols && (
              <div className={styles.missingCols}>
                <span>
                  <b>Missing COLS:</b> {formatCols(missingCols)}
                </span>
                <button
                  className={styles.stakeBtn}
                  onClick={() =>
                    window.open(
                      'https://app.multiversx.com/tokens/COLS-9d91b7',
                      '_blank'
                    )
                  }
                  disabled={hasEnoughCols}
                >
                  Stake {formatCols(missingCols > 0 ? missingCols : requiredCols)} COLS
                </button>
                <HelpIcon text="Stake COLS tokens here. You must have at least the required amount staked before you can claim the reward or undelegate from the other provider." />
              </div>
            )}
            {hasEnoughCols && (
              <div
                style={{
                  color: '#6ee7c7',
                  fontWeight: 600,
                  marginTop: 8
                }}
              >
                You have enough COLS staked to migrate the selected eGLD.
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <b>10-day APR Reward (in COLS):</b> {apr10d}
              <HelpIcon text="This is the amount of COLS you will receive as a reward for moving your eGLD and staking COLS." />
            </div>
            <div style={{ marginTop: 12 }}>
              <b>Status:</b>{' '}
              {status === 'none' && 'Select provider(s) and stake COLS'}
              {status === 'undelegating' && 'Waiting for undelegation...'}
              {status === 'eligible' &&
                'Eligible! You can now claim your reward.'}
              {status === 'completed' &&
                'Completed! You will receive your reward soon.'}
              <HelpIcon text="You can only claim the reward after you have staked the required COLS and completed the undelegation from your previous provider(s)." />
            </div>
            <div style={{ marginTop: 18 }}>
              <ContactClaimButton
                disabled={!(status === 'eligible')}
                selectedProviders={selectedProviders}
                totalEgld={totalEgldToMigrate}
                userAddress={address}
              />
            </div>
          </div>
        )}
        {undelegateModal && (
          <UndelegateModal
            show={!!undelegateModal}
            onClose={async () => {
              setUndelegateModal(null);
              await fetchAllData();
            }}
            providerName={undelegateModal.providerName}
            contract={undelegateModal.contract}
            maxAmount={undelegateModal.maxAmount}
            egldLabel={network.egldLabel}
          />
        )}
      </div>
    </div>
  );
}
