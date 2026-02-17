import { useState, useEffect, MouseEvent } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useGetActiveTransactionsStatus } from 'hooks/useTransactionStatus';
import { sendTransactions } from 'helpers/sendTransactions';
import classNames from 'classnames';
import { Formik } from 'formik';
import { object, string } from 'yup';
import BigNumber from 'bignumber.js';
import axios from 'axios';

import { Action, Submit } from 'components/Action';
import { network } from 'config';
import { fetchClaimableColsAndLockTime } from 'helpers/fetchClaimableCols';

import styles from './styles.module.scss';

const COLS_TOKEN_ID = 'COLS-9d91b7';
const COLS_TOKEN_ID_HEX = '434f4c532d396439316237';
const STAKE_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const GAS_LIMIT = 15_000_000;
const WITHDRAW_GAS_LIMIT = 200_000_000;
const STAKE_METHOD_HEX = '7374616b65';
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

function formatLockTime(lockTimestamp: number) {
  if (lockTimestamp === 0) return 'No lock';
  const now = Math.floor(Date.now() / 1000);
  const diff = lockTimestamp - now;
  if (diff <= 0) return 'Unlocked';
  const days = Math.floor(diff / (3600 * 24));
  const hours = Math.floor((diff % (3600 * 24)) / 3600);
  return `${days}d ${hours}h`;
}

export const StakeCols = () => {
  const account = useGetAccount();
  const address = account.address;
  const { pending } = useGetActiveTransactionsStatus();
  const [error, setError] = useState<string | null>(null);
  const [colsBalance, setColsBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(true);
  const [withdrawPending, setWithdrawPending] = useState(false);
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

  const handleWithdrawClick = async () => {
    setError(null);
    setWithdrawPending(true);
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

  const isWithdrawEnabled = lockTimeRaw !== null && lockTimeRaw <= Math.floor(Date.now() / 1000);
  const isLocked = lockTimeRaw !== null && lockTimeRaw > Math.floor(Date.now() / 1000);

  return (
    <div className={styles.wrapper}>
      {/* Stake COLS Button */}
      <Action
        title="Stake COLS"
        description="Enter the amount of COLS tokens you want to stake. Staking increases your APR bonus."
        disabled={pending}
        trigger={
          <div
            className={classNames(styles.trigger, styles.triggerAccent, {
              [styles.disabled]: pending
            })}
          >
            <span className={styles.triggerIcon}>🔥</span>
            <span className={styles.triggerLabel}>Stake COLS</span>
          </div>
        }
        render={(onClose: () => void) => (
          <div className={styles.form}>
            <Formik
              enableReinitialize
              validationSchema={object().shape({
                amount: string()
                  .required('Required')
                  .test('is-positive', 'Amount must be greater than 0', (value = '') => {
                    try {
                      return new BigNumber(value).isGreaterThan(0);
                    } catch {
                      return false;
                    }
                  })
                  .test('max', `You cannot stake more than your available COLS balance.`, (value = '') => {
                    try {
                      return new BigNumber(value).lte(colsBalance || '0');
                    } catch {
                      return false;
                    }
                  })
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
                  <form onSubmit={handleSubmit}>
                    <div className={styles.field}>
                      <label htmlFor="amount" className={styles.label}>COLS Amount</label>
                      <div className={styles.inputWrapper}>
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
                          placeholder="0.00"
                        />
                        <button
                          type="button"
                          onClick={onMax}
                          className={styles.maxButton}
                          disabled={loading || colsBalance === '0'}
                        >
                          MAX
                        </button>
                      </div>
                      <div className={styles.balance}>
                        Available: <span>{loading ? '...' : colsBalance} COLS</span>
                      </div>
                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>
                    {error && <span className={styles.error}>{error}</span>}
                    <Submit
                      save="Stake Now"
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

      {/* Lock Time Info */}
      <div className={classNames(styles.lockInfo, { [styles.unlocked]: !isLocked })}>
        {isLocked ? (
          <span className={styles.lockText}>
            🔒 Lock Time Remaining: <span className={styles.lockTime}>{lockTimeFormatted}</span>
          </span>
        ) : (
          <span className={styles.lockText}>
            ✅ <span className={styles.lockTimeUnlocked}>COLS are unlocked</span> - ready to withdraw
          </span>
        )}
      </div>

      {/* Withdraw COLS Button */}
      <button
        type="button"
        className={classNames(styles.withdrawButton, {
          [styles.disabled]: pending || !isWithdrawEnabled || withdrawPending
        })}
        onClick={handleWithdrawClick}
        disabled={pending || !isWithdrawEnabled || withdrawPending}
        title={isWithdrawEnabled ? "Withdraw COLS" : `COLS locked. Remaining: ${lockTimeFormatted}`}
      >
        <span className={styles.triggerIcon}>🔓</span>
        <span className={styles.triggerLabel}>Withdraw</span>
      </button>
    </div>
  );
};