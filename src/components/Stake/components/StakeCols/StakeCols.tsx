import { useState, useEffect, MouseEvent } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useGetActiveTransactionsStatus } from '@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';
import classNames from 'classnames';
import { Formik } from 'formik';
import { object, string } from 'yup';
import BigNumber from 'bignumber.js';
import axios from 'axios';

import { Action, Submit } from 'components/Action';
import { network } from 'config';

import styles from '../Delegate/styles.module.scss';
import stakeColsStyles from './styles.module.scss';

// --- NEW: Info Modal for 15-day lock ---
import { Modal } from 'react-bootstrap';

const COLS_TOKEN_ID = 'COLS-9d91b7';
const COLS_TOKEN_ID_HEX = '434f4c532d396439316237';
const STAKE_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const GAS_LIMIT = 10_000_000;
const STAKE_METHOD_HEX = '7374616b65'; // "stake" in hex
const FIXED_HEX_ADDRESS = '00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787';

function amountToHex(amount: string) {
  // 18 decimals for COLS
  const value = new BigNumber(amount).multipliedBy('1e18').toFixed(0);
  let hex = new BigNumber(value).toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

function denominateCols(raw: string) {
  // 18 decimals for COLS
  if (!raw || raw === '0') return '0';
  let str = raw.padStart(19, '0');
  const intPart = str.slice(0, -18) || '0';
  let decPart = str.slice(-18).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

// --- NEW: Info Modal for 15-day lock ---
function LockInfoModal({ show, onClose, onConfirm }: { show: boolean, onClose: () => void, onConfirm: () => void }) {
  return (
    <Modal show={show} onHide={onClose} centered animation={false}>
      <div style={{ padding: 32, textAlign: 'center', background: '#242526', borderRadius: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#6ee7c7' }}>
          <span role="img" aria-label="lock">🔒</span> 15-Day Lock Period
        </div>
        <div style={{ color: '#fff', fontSize: 16, marginBottom: 18 }}>
          <b>Important:</b> When you stake COLS tokens, they will be <span style={{ color: '#ffe082' }}>locked for 15 days</span>.<br />
          You will not be able to withdraw or transfer your staked COLS during this period.
        </div>
        <button
          style={{
            background: '#6ee7c7',
            color: '#181a1b',
            fontWeight: 700,
            borderRadius: 7,
            padding: '12px 30px',
            border: 'none',
            fontSize: 16,
            marginTop: 8,
            boxShadow: '0 2px 8px #6ee7c7aa'
          }}
          onClick={onConfirm}
        >
          I Understand, Continue
        </button>
      </div>
    </Modal>
  );
}

// --- NEW: Withdraw Warning Modal ---
function WithdrawWarningModal({ show, onClose, onConfirm }: { show: boolean, onClose: () => void, onConfirm: () => void }) {
  return (
    <Modal show={show} onHide={onClose} centered animation={false}>
      <div style={{ padding: 32, textAlign: 'center', background: '#242526', borderRadius: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#ff9800' }}>
          <span role="img" aria-label="warning">⚠️</span> Withdrawal Notice
        </div>
        <div style={{ color: '#fff', fontSize: 16, marginBottom: 18 }}>
          <b>Before Withdrawing:</b><br />
          Please ensure your <span style={{ color: '#ffe082' }}>last COLS stake</span> is older than <b>15 days</b>.
        </div>
        <button
          style={{
            background: '#ff9800',
            color: '#181a1b',
            fontWeight: 700,
            borderRadius: 7,
            padding: '12px 30px',
            border: 'none',
            fontSize: 16,
            marginTop: 8,
            boxShadow: '0 2px 8px #ff9800aa'
          }}
          onClick={onConfirm}
        >
          Yes, Proceed to Withdraw
        </button>
        <button
          style={{
            background: '#303234',
            color: '#fff',
            fontWeight: 600,
            borderRadius: 7,
            padding: '10px 24px',
            border: 'none',
            fontSize: 15,
            marginTop: 16,
            marginLeft: 8
          }}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export const StakeCols = () => {
  const { address } = useGetAccountInfo();
  const { pending } = useGetActiveTransactionsStatus();
  const [error, setError] = useState<string | null>(null);
  const [colsBalance, setColsBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(true);

  // --- NEW: Modal state for lock info ---
  const [showLockInfo, setShowLockInfo] = useState(false);
  const [pendingStakeAction, setPendingStakeAction] = useState<null | (() => void)>(null);

  // --- NEW: Modal state for withdraw warning ---
  const [showWithdrawWarning, setShowWithdrawWarning] = useState(false);
  const [pendingWithdrawAction, setPendingWithdrawAction] = useState<null | (() => void)>(null);

  // Fetch COLS balance
  useEffect(() => {
    const fetchCols = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${network.apiAddress}/accounts/${address}/tokens?identifier=${COLS_TOKEN_ID}`
        );
        if (Array.isArray(data) && data.length > 0 && data[0].identifier === COLS_TOKEN_ID) {
          setColsBalance(denominateCols(data[0].balance));
        } else {
          setColsBalance('0');
        }
      } catch {
        setColsBalance('0');
      }
      setLoading(false);
    };
    if (address) fetchCols();
  }, [address]);

  // --- NEW: Wrapped Withdraw Handler ---
  const handleWithdraw = async () => {
    setError(null);
    try {
      // Show warning modal before actual withdraw
      setShowWithdrawWarning(true);
      setPendingWithdrawAction(() => async () => {
        setShowWithdrawWarning(false);
        try {
          await sendTransactions({
            transactions: [
              {
                value: '0',
                data: 'withdraw@00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787',
                receiver: STAKE_CONTRACT,
                gasLimit: GAS_LIMIT
              }
            ]
          });
        } catch (e: any) {
          setError(e?.message || 'Failed to send transaction');
        }
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to send transaction');
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* --- Lock Info Modal for Staking --- */}
      <LockInfoModal
        show={showLockInfo}
        onClose={() => {
          setShowLockInfo(false);
          setPendingStakeAction(null);
        }}
        onConfirm={() => {
          setShowLockInfo(false);
          if (pendingStakeAction) pendingStakeAction();
          setPendingStakeAction(null);
        }}
      />
      {/* --- Withdraw Warning Modal --- */}
      <WithdrawWarningModal
        show={showWithdrawWarning}
        onClose={() => {
          setShowWithdrawWarning(false);
          setPendingWithdrawAction(null);
        }}
        onConfirm={() => {
          if (pendingWithdrawAction) pendingWithdrawAction();
          setPendingWithdrawAction(null);
        }}
      />
      <Action
        title="Stake COLS"
        description="Enter the amount of COLS tokens you want to stake."
        disabled={pending}
        trigger={
          <div
            className={classNames(styles.trigger, styles.fireButton, {
              [styles.disabled]: pending
            })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontWeight: 700,
              fontSize: '16px'
            }}
          >
            Stake COLS
          </div>
        }
        render={(onClose: () => void) => (
          <div className={styles.delegate}>
            <Formik
              enableReinitialize
              validationSchema={object().shape({
                amount: string()
                  .required('Required')
                  .test(
                    'is-positive',
                    'Amount must be greater than 0',
                    (value = '') => {
                      try {
                        return new BigNumber(value).isGreaterThan(0);
                      } catch {
                        return false;
                      }
                    }
                  )
                  .test(
                    'max',
                    `You cannot stake more than your available COLS balance.`,
                    (value = '') => {
                      try {
                        return new BigNumber(value).lte(colsBalance || '0');
                      } catch {
                        return false;
                      }
                    }
                  )
              })}
              initialValues={{ amount: '1' }}
              onSubmit={async ({ amount }) => {
                setError(null);
                // Show lock info modal before actual stake
                setShowLockInfo(true);
                setPendingStakeAction(() => async () => {
                  try {
                    // Build ESDTTransfer@TOKEN_ID_HEX@amountHex@stake@FIXED_HEX_ADDRESS
                    const amountHex = amountToHex(amount);
                    const data = [
                      'ESDTTransfer',
                      COLS_TOKEN_ID_HEX,
                      amountHex,
                      STAKE_METHOD_HEX,
                      FIXED_HEX_ADDRESS
                    ].join('@');

                    await sendTransactions({
                      transactions: [
                        {
                          value: '0',
                          data,
                          receiver: STAKE_CONTRACT,
                          gasLimit: GAS_LIMIT
                        }
                      ]
                    });
                    onClose();
                  } catch (e: any) {
                    setError(e?.message || 'Failed to send transaction');
                  }
                });
              }}
            >
              {({
                errors,
                values,
                touched,
                handleChange,
                handleBlur,
                handleSubmit,
                setFieldValue
              }) => {
                const onMax = (event: MouseEvent) => {
                  event.preventDefault();
                  setFieldValue('amount', colsBalance);
                };

                return (
                  <form onSubmit={handleSubmit}>
                    <div className={styles.field}>
                      <label htmlFor="amount">COLS Amount</label>
                      <div className={styles.group}>
                        <input
                          type="number"
                          name="amount"
                          step="any"
                          required
                          autoComplete="off"
                          min={0}
                          value={values.amount}
                          onBlur={handleBlur}
                          onChange={handleChange}
                          className={classNames(styles.input, {
                            [styles.invalid]: errors.amount && touched.amount
                          })}
                        />
                        <a
                          href="/#"
                          onClick={onMax}
                          className={classNames(styles.max, {
                            [styles.disabled]: loading || colsBalance === '0'
                          })}
                          style={{
                            position: 'absolute',
                            right: 5,
                            top: 5,
                            bottom: 5,
                            background: '#303234',
                            color: '#fff',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px',
                            textDecoration: 'none'
                          }}
                        >
                          Max
                        </a>
                      </div>
                      <span className={styles.description}>
                        <span>Balance:</span> {loading ? '...' : colsBalance} COLS
                      </span>
                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>
                    {error && (
                      <span className={styles.error}>{error}</span>
                    )}
                    <Submit
                      save="Continue"
                      onClose={() => {
                        setFieldValue('amount', '1');
                        setError(null);
                      }}
                    />
                  </form>
                );
              }}
            </Formik>
          </div>
        )}
      />
      {/* --- Withdraw COLS Button (with warning) --- */}
      <div style={{ marginTop: 16, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          className={classNames(stakeColsStyles.trigger, {
            [stakeColsStyles.disabled]: pending
          })}
          onClick={handleWithdraw}
          disabled={pending}
        >
          Withdraw COLS
        </button>
      </div>
      {/* Removed the lower Withdraw COLS button */}
    </div>
  );
};
