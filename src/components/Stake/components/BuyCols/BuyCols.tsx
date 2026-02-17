import { useState } from 'react';
import { Formik } from 'formik';
import { object, string } from 'yup';
import BigNumber from 'bignumber.js';
import classNames from 'classnames';
import { sendTransactions } from 'helpers/sendTransactions';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';

import { Action, Submit } from 'components/Action';
import styles from './styles.module.scss';

const WRAP_CONTRACT = 'erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3ntjj3';
const WRAP_FUNC = 'wrapEgld';
const WRAP_GAS_LIMIT = 10000000;

const SWAP_CONTRACT = 'erd1qqqqqqqqqqqqqpgq3r2vzqe89x23lryqmlp9xynf9t46qnpa2jpsrh63az';
const SWAP_GAS_LIMIT = 150000000;
const WEGLD_TOKEN_ID = '5745474c442d626434643739';
const COLS_TOKEN_ID = '434f4c532d396439316237';
const SWAP_FUNC_HEX = '73776170546f6b656e734669786564496e707574';

function amountToHex(amount: string) {
  const value = new BigNumber(amount).multipliedBy('1e18').toFixed(0);
  let hex = new BigNumber(value).toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

export const BuyCols = () => {
  const account = useGetAccount();
  const balanceRaw = account?.balance || '0';
  const balanceEgld = new BigNumber(balanceRaw).dividedBy('1e18').toFixed(6);

  const [wrapSuccess, setWrapSuccess] = useState(false);
  const [wrapLoading, setWrapLoading] = useState(false);
  const [wrapError, setWrapError] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [wrappedAmount, setWrappedAmount] = useState<string>('1');

  const handleWrapSubmit = async (amount: string, onClose: () => void) => {
    setWrapError(null);
    setWrapLoading(true);
    setWrapSuccess(false);
    try {
      const value = new BigNumber(amount).multipliedBy('1e18').toFixed(0);
      await sendTransactions({
        transactions: [
          {
            value,
            data: WRAP_FUNC,
            receiver: WRAP_CONTRACT,
            gasLimit: WRAP_GAS_LIMIT
          }
        ]
      });
      setWrappedAmount(amount);
      setWrapSuccess(true);
      onClose();
    } catch (e: any) {
      setWrapError(e?.message || 'Failed to wrap eGLD');
    }
    setWrapLoading(false);
  };

  const handleSwapClick = async () => {
    setSwapError(null);
    setSwapLoading(true);
    try {
      const amountHex = amountToHex(wrappedAmount);
      const data = [
        'ESDTTransfer',
        WEGLD_TOKEN_ID,
        amountHex,
        SWAP_FUNC_HEX,
        COLS_TOKEN_ID,
        '01'
      ].join('@');

      await sendTransactions({
        transactions: [
          {
            value: '0',
            data,
            receiver: SWAP_CONTRACT,
            gasLimit: SWAP_GAS_LIMIT
          }
        ]
      });
    } catch (e: any) {
      setSwapError(e?.message || 'Failed to swap WEGLD to COLS');
    }
    setSwapLoading(false);
  };

  return (
    <div className={styles.buySection}>
      <div className={styles.swapHeader}>
        <span className={styles.swapIcon}>💱</span>
        <div>
          <h3 className={styles.swapTitle}>Get COLS</h3>
          <p className={styles.swapDesc}>Swap eGLD for COLS tokens</p>
        </div>
      </div>

      <Action
        title="Swap eGLD to COLS"
        description="Enter the amount of eGLD you want to swap. This is a 2-step process: wrap eGLD to WEGLD, then swap to COLS."
        disabled={wrapLoading}
        trigger={
          <div
            className={classNames(styles.trigger, styles.triggerSecondary, {
              [styles.disabled]: wrapLoading
            })}
          >
            <span className={styles.triggerIcon}>🔄</span>
            <span className={styles.triggerLabel}>Swap eGLD → COLS</span>
          </div>
        }
        render={(onClose: () => void) => (
          <div className={styles.form}>
            <Formik
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
                  .test('max-balance', `Amount cannot exceed your wallet balance (${balanceEgld} eGLD).`, (value = '') => {
                    try {
                      return new BigNumber(value).lte(balanceEgld);
                    } catch {
                      return false;
                    }
                  })
              })}
              initialValues={{ amount: '1' }}
              onSubmit={({ amount }) => handleWrapSubmit(amount, onClose)}
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
                const onMaxClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  setFieldValue('amount', balanceEgld);
                };

                return (
                  <form onSubmit={handleSubmit}>
                    <div className={styles.field}>
                      <label htmlFor="amount" className={styles.label}>eGLD Amount</label>
                      <div className={styles.inputWrapper}>
                        <input
                          type="number"
                          name="amount"
                          step="any"
                          required
                          autoComplete="off"
                          min={0}
                          max={balanceEgld}
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
                          onClick={onMaxClick}
                          className={styles.maxButton}
                          disabled={wrapLoading}
                        >
                          MAX
                        </button>
                      </div>
                      <div className={styles.balance}>
                        Available: <span>{balanceEgld} eGLD</span>
                      </div>
                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>
                    {wrapError && <span className={styles.error}>{wrapError}</span>}
                    <Submit
                      save="Swap"
                      onClose={() => {
                        setFieldValue('amount', '1');
                        setWrapError(null);
                      }}
                    />
                  </form>
                );
              }}
            </Formik>
          </div>
        )}
      />

      {wrapSuccess && (
        <div className={styles.stepTwo}>
          <div className={styles.stepTwoInfo}>
            <span>✅ Step 1 complete! Now complete the swap:</span>
          </div>
          <button
            type="button"
            className={classNames(styles.completeButton, {
              [styles.disabled]: swapLoading
            })}
            onClick={handleSwapClick}
            disabled={swapLoading}
          >
            {swapLoading ? 'Processing...' : 'Complete Swap'}
          </button>
        </div>
      )}
      {swapError && <div className={styles.error}>{swapError}</div>}
    </div>
  );
};