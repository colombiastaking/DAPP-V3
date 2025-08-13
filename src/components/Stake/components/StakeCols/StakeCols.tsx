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

import { Modal } from 'react-bootstrap';

import { fetchClaimableColsAndLockTime } from 'helpers/fetchClaimableCols';

const COLS_TOKEN_ID = 'COLS-9d91b7';
const COLS_TOKEN_ID_HEX = '434f4c532d396439316237';
const STAKE_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const GAS_LIMIT = 15_000_000;
const WITHDRAW_GAS_LIMIT = 20_000_000;
const STAKE_METHOD_HEX = '7374616b65'; // "stake" in hex
const FIXED_HEX_ADDRESS = '00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787';

function amountToHex(amount: string) {
  const value = new BigNumber(amount).multipliedBy('1e18').toFixed(0);
  let hex = new BigNumber(value).toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

function denominateCols(raw: string) {
  if (!raw || raw === '0') return '0';
  let str = raw.padStart(19, '0');
  const intPart = str.slice(0, -18) || '0';
  let decPart = str.slice(-18).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

function LockInfoModal({ show, onClose, onConfirm }: { show: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal show={show} onHide={onClose} centered animation={false}>
      <div style={{ padding: 32, textAlign: 'center', background: '#242526', borderRadius: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 12, color: '#6ee7c7' }}>
          <span role="img" aria-label="lock">🔒</span> 15-Day Lock Period
        </div>
        <div style={{ color: '#fff', fontSize: 16, marginBottom: 18 }}>
          <b>Important:</b> Please ensure your last stake transaction is older than 15 days.<br />
          Otherwise, your COLS tokens are still locked and cannot be withdrawn.
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
            boxShadow: '0 2px 8px #6ee7c7aa',
            cursor: 'pointer'
          }}
          onClick={onConfirm}
        >
          I Understand, Withdraw COLS
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

  const [showLockInfo, setShowLockInfo] = useState(false);
  const [withdrawPending, setWithdrawPending] = useState(false);

  // New lock time state
  const [lockTimeRaw, setLockTimeRaw] = useState<number | null>(null);
  const [lockTimeFormatted, setLockTimeFormatted] = useState<string>("");

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

    const fetchLockTime = async () => {
      if (!address) {
        setLockTimeRaw(null);
        setLockTimeFormatted('');
        return;
      }
      try {
        const { lockTime } = await fetchClaimableColsAndLockTime({
          contract: STAKE_CONTRACT,
          entity: 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0',
          user: address,
          providerUrl: network.gatewayAddress
        });
        setLockTimeRaw(lockTime);
        setLockTimeFormatted(formatLockTime(lockTime));
      } catch {
        setLockTimeRaw(null);
        setLockTimeFormatted('');
      }
    };

    fetchCols();
    fetchLockTime();
  }, [address]);

  function formatLockTime(lockTimestamp: number) {
    if (lockTimestamp === 0) return 'No lock';
    const now = Math.floor(Date.now() / 1000);
    const diff = lockTimestamp - now;
    if (diff <= 0) return 'Unlocked';
    const days = Math.floor(diff / (3600 * 24));
    const hours = Math.floor((diff % (3600 * 24)) / 3600);
    return `${days}d ${hours}h`;
  }

  const handleWithdrawConfirmed = async () => {
    setShowLockInfo(false);
    setWithdrawPending(true);
    setError(null);
    try {
      await sendTransactions({
        transactions: [
          {
            value: '0',
            data: 'withdraw@00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787',
            receiver: STAKE_CONTRACT,
            gasLimit: WITHDRAW_GAS_LIMIT
          }
        ]
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to send transaction');
    }
    setWithdrawPending(false);
  };

  const handleWithdrawClick = () => {
    setShowLockInfo(true);
  };

  const handleStakeSubmit = async (amount: string, onClose: () => void) => {
    setError(null);
    try {
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
  };

  // Button enabled only if lock time expired or no lock
  const isWithdrawEnabled = lockTimeRaw !== null && lockTimeRaw <= Math.floor(Date.now() / 1000);

  return (
    <div className={styles.wrapper}>
      <LockInfoModal
        show={showLockInfo}
        onClose={() => setShowLockInfo(false)}
        onConfirm={handleWithdrawConfirmed}
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
              onSubmit={({ amount }) => handleStakeSubmit(amount, onClose)}
            >
              {({
                errors,
                values,
                touched,
                handleBlur,
                handleChange,
                handleSubmit,
                setFieldValue
              }) => {
                const onMax = (event: MouseEvent) => {
                  event.preventDefault();
                  setFieldValue('amount', colsBalance);
                };

                return (
                  <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
                    <div className={styles.field}>
                      <label htmlFor="amount">COLS Amount</label>
                      <div className={styles.group} style={{ position: 'relative' }}>
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
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#303234',
                            color: '#fff',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '10px',
                            textDecoration: 'none',
                            maxWidth: '60px',
                            height: 'auto',
                            lineHeight: 'normal'
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
      <div style={{ marginTop: 16, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          type="button"
          className={classNames(stakeColsStyles.trigger, {
            [stakeColsStyles.disabled]: pending || !isWithdrawEnabled || withdrawPending
          })}
          onClick={handleWithdrawClick}
          disabled={pending || !isWithdrawEnabled || withdrawPending}
          title={isWithdrawEnabled ? "Withdraw COLS" : `COLS locked. Remaining: ${lockTimeFormatted}`}
        >
          Withdraw COLS
        </button>
        <div style={{ marginTop: 8, color: '#6ee7c7', fontSize: 14 }}>
          {lockTimeRaw !== null && lockTimeRaw > Math.floor(Date.now() / 1000) ? (
            <>Remaining Lock Time: {lockTimeFormatted}</>
          ) : (
            <>COLS tokens are unlocked and can be withdrawn</>
          )}
        </div>
      </div>
    </div>
  );
};
