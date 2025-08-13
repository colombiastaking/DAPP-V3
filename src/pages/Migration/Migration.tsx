import { useEffect, useState, useRef } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import axios from 'axios';
import classNames from 'classnames';
import { network } from 'config';
import { useColsAprContext } from '../../context/ColsAprContext';
import { Formik } from 'formik';
import { object, string } from 'yup';
import BigNumber from 'bignumber.js';
import { Modal } from 'react-bootstrap';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';
import { HelpIcon } from 'components/HelpIcon';
import styles from './Migration.module.scss';

function formatEgld(amount: string | number) {
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
                <span role="img" aria-label="telegram">💬</span> Telegram
              </a>
              <button className={styles.copyBtn} onClick={handleCopy} style={{marginLeft:8}}>
                {copied ? "Copied!" : "Copy Message"}
              </button>
            </li>
            <li>
              <a href="https://x.com/ColombiaStaking" target="_blank" rel="noopener noreferrer">
                <span role="img" aria-label="x">𝕏</span> X
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

function Withdrawal({
  providerName,
  contract,
  amount,
  seconds,
  onWithdrawn
}: {
  providerName: string,
  contract: string,
  amount: string,
  seconds: number,
  onWithdrawn?: () => void
}) {
  const [counter, setCounter] = useState(seconds);
  const [pending, setPending] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCounter(seconds);
    if (seconds > 0) {
      intervalRef.current = setInterval(() => {
        setCounter((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [seconds]);

  const getTimeLeft = () => {
    if (counter <= 0) return "Ready";
    const h = Math.floor(counter / 3600);
    const m = Math.floor((counter % 3600) / 60);
    const s = counter % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const handleWithdraw = async () => {
    setPending(true);
    try {
      await sendTransactions({
        transactions: [
          {
            value: "0",
            data: "withdraw",
            receiver: contract,
            gasLimit: 12000000
          }
        ]
      });
      setPending(false);
      if (onWithdrawn) onWithdrawn();
    } catch {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        background: "#23272a",
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexDirection: "row"
      }}
    >
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontWeight: 700, color: "#6ee7c7", fontSize: 15 }}>{providerName}</div>
        <div style={{ fontSize: 15 }}>
          <b>{formatEgld(amount)} EGLD</b>
        </div>
        <div style={{ fontSize: 13, color: "#ffe082" }}>
          {counter > 0 ? (
            <span>{getTimeLeft()}</span>
          ) : (
            <span>Ready</span>
          )}
        </div>
      </div>
      <button
        type="button"
        style={{
          background: counter > 0 ? "#303234" : "#6ee7c7",
          color: counter > 0 ? "#888" : "#181a1b",
          fontWeight: 700,
          borderRadius: 7,
          padding: "10px 18px",
          border: "none",
          fontSize: 15,
          cursor: counter > 0 || pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.7 : 1,
          minWidth: 100
        }}
        disabled={counter > 0 || pending}
        onClick={handleWithdraw}
      >
        {pending ? "Processing..." : "Withdraw"}
      </button>
    </div>
  );
}

export const Migration = () => {
  const { address } = useGetAccountInfo();
  const [loading, setLoading] = useState(true);
  const [providerMap, setProviderMap] = useState<Record<string, string>>({});
  const [delegationList, setDelegationList] = useState<any[]>([]);
  const [providerDetails, setProviderDetails] = useState<any[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [undelegateModal, setUndelegateModal] = useState<{contract: string, providerName: string, maxAmount: string} | null>(null);

  const { baseApr, colsPrice, egldPrice } = useColsAprContext();

  const fetchProviderListAndDelegation = async () => {
    setLoading(true);
    try {
      const [provRes, delRes] = await Promise.all([
        axios.get('https://api.multiversx.com/providers?type=staking'),
        axios.get(`https://api.multiversx.com/accounts/${address}/delegation`)
      ]);
      const map: Record<string, string> = {};
      for (const p of provRes.data || []) {
        map[p.provider] = p.identity || p.provider;
      }
      setProviderMap(map);

      setDelegationList(delRes.data || []);
    } catch {
      setDelegationList([]);
    }
    setLoading(false);
  };

  const buildProviderDetailsFromDelegationList = () => {
    setLoading(true);
    try {
      const providers: any[] = [];
      (delegationList || []).forEach((d: any) => {
        if (!d.contract || d.contract === network.delegationContract) return;
        const providerName = providerMap[d.contract] || d.contract;
        if (d.userActiveStake && Number(d.userActiveStake) > 0) {
          providers.push({
            contract: d.contract,
            userActiveStake: d.userActiveStake,
            waiting: false,
            waitingAmount: '0',
            providerName,
            key: d.contract + '-active'
          });
        }
        if (Array.isArray(d.userUndelegatedList) && d.userUndelegatedList.length > 0) {
          d.userUndelegatedList.forEach((u: any, idx: number) => {
            if (Number(u.amount) > 0) {
              providers.push({
                contract: d.contract,
                userActiveStake: '0',
                waiting: true,
                waitingAmount: u.amount,
                providerName,
                timeLeft: u.seconds,
                key: d.contract + '-waiting-' + idx
              });
            }
          });
        }
      });
      setProviderDetails(providers);
    } catch {
      setProviderDetails([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!address) return;
    fetchProviderListAndDelegation();
  }, [address]);

  useEffect(() => {
    if (delegationList.length > 0) {
      buildProviderDetailsFromDelegationList();
    } else {
      setProviderDetails([]);
    }
  }, [JSON.stringify(delegationList)]);

  const selectedProviders = providerDetails
    .filter((d: any) => selectedContracts.includes(d.key))
    .map((d: any) => ({
      ...d,
      name: d.providerName
    }));

  const totalEgldToMigrateNum = selectedProviders.reduce(
    (sum, d) =>
      sum.plus(
        d.waiting
          ? new BigNumber(d.waitingAmount).dividedBy(1e18)
          : new BigNumber(d.userActiveStake).dividedBy(1e18)
      ),
    new BigNumber(0)
  );

  const apr10d =
    baseApr && egldPrice && colsPrice && totalEgldToMigrateNum.gt(0)
      ? totalEgldToMigrateNum.multipliedBy(baseApr / 100).multipliedBy(10 / 365).multipliedBy(egldPrice).dividedBy(colsPrice).toFixed(3)
      : '0';

  if (loading) return <div className={styles.centered}><div className={styles.loading}>Loading...</div></div>;

  return (
    <div className={styles.centered}>
      <div className={styles.benefitBox}>
        <h3 className={styles.sectionTitle}>
          10 days Migration Benefit
          <HelpIcon text={
            "To be eligible, you must stake COLS tokens equal to the sum of your current Colombia Staking eGLD delegation plus the eGLD amount you want to migrate from other providers.\n\nExample: If you have 1250 eGLD delegated at Colombia Staking and want to migrate 50 eGLD from other providers, you must stake at least 1300 COLS tokens.\n\nSelect one or more providers below to start the migration process."
          } />
        </h3>
        <div className={styles.section}>
          <div className={styles.rowLabel}>
            Your eGLD Staked with Other Providers
            <HelpIcon text="These are your current eGLD delegations with other providers. Select one or more to start the migration process. eGLD in waiting period (unbonding) is also shown." />
          </div>
          {providerDetails.length === 0 && (
            <div>No eGLD staked or waiting with other providers.</div>
          )}
          <div className={styles.providersButtonList} style={{ flexDirection: "column", gap: 12 }}>
            {providerDetails.map((d: any) => {
              const providerName = d.providerName;
              const key = d.key;
              const isSelected = selectedContracts.includes(key);
              return (
                <div key={key} style={{ width: "100%" }}>
                  <button
                    className={classNames(styles.providerBtn, {
                      [styles.selectedBtn]: isSelected
                    })}
                    style={{
                      width: "100%",
                      marginBottom: 8,
                      textAlign: "center",
                      justifyContent: "center",
                      alignItems: "center",
                      display: "flex",
                      flexDirection: "column"
                    }}
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
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{providerName}</div>
                    <div style={{ fontSize: 15, margin: "4px 0" }}>
                      {d.waiting ? (
                        <span>Waiting: {formatEgld(d.waitingAmount)} EGLD</span>
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
                        {/* Always allow undelegate */}
                        {!d.waiting && (
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
                              : "You can undelegate from this provider."
                          }
                        />
                      </div>
                    )}
                  </button>
                  {d.waiting && (
                    <Withdrawal
                      providerName={providerName}
                      contract={d.contract}
                      amount={d.waitingAmount}
                      seconds={Number(d.timeLeft)}
                      onWithdrawn={fetchProviderListAndDelegation}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {selectedContracts.length > 0 && (
          <div className={styles.section}>
            <div className={styles.rowLabel}>
              Step 2: Stake COLS
              <HelpIcon text="You must stake COLS tokens equal to your current Colombia Staking eGLD delegation plus the eGLD amount you want to migrate." />
            </div>
            <div>
              <button
                className={styles.stakeBtn}
                onClick={() => {
                  const amount = prompt('Enter amount of COLS to stake:', '1');
                  if (amount !== null) {
                    const num = parseInt(amount, 10);
                    if (!isNaN(num) && num > 0) {
                      alert(`You entered to stake ${num} COLS tokens. Please use the Stake tab to stake tokens.`);
                    } else {
                      alert('Please enter a valid positive integer amount.');
                    }
                  }
                }}
              >
                Stake COLS Tokens
              </button>
              <HelpIcon text="Enter the amount of COLS tokens you want to stake. This is a neutral prompt; please use the Stake tab to perform staking." />
            </div>
            <div style={{ marginTop: 12 }}>
              <b>10-day APR Reward (in COLS):</b> {apr10d}
              <HelpIcon text="This is the amount of COLS you will receive as a reward for moving your eGLD and staking COLS." />
            </div>
            <div style={{ marginTop: 12 }}>
              <b>Status:</b> Select provider(s) and stake COLS
              <HelpIcon text="Claim Contact button is always available. Please ensure you have staked enough COLS tokens as per eligibility condition." />
            </div>
            <div style={{ marginTop: 18 }}>
              <ContactClaimButton
                disabled={false}
                selectedProviders={selectedProviders}
                totalEgld={totalEgldToMigrateNum.toNumber()}
                userAddress={address}
              />
            </div>
          </div>
        )}
        {undelegateModal && (
          <UndelegateModal
            show={!!undelegateModal}
            onClose={() => setUndelegateModal(null)}
            providerName={undelegateModal.providerName}
            contract={undelegateModal.contract}
            maxAmount={undelegateModal.maxAmount}
            egldLabel={network.egldLabel}
          />
        )}
      </div>
    </div>
  );
};
