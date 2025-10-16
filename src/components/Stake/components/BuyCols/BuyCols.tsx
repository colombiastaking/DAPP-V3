import { useState } from 'react';
import { Formik } from 'formik';
import { object, string } from 'yup';
import BigNumber from 'bignumber.js';
import classNames from 'classnames';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';

import { Action, Submit } from 'components/Action';
import styles from '../Delegate/styles.module.scss';

const WRAP_CONTRACT = 'erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3ntjj3';
const WRAP_FUNC = 'wrapEgld';
const WRAP_GAS_LIMIT = 10000000;

const SWAP_CONTRACT = 'erd1qqqqqqqqqqqqqpgq3r2vzqe89x23lryqmlp9xynf9t46qnpa2jpsrh63az';
const SWAP_GAS_LIMIT = 150000000;
const WEGLD_TOKEN_ID = '5745474c442d626434643739'; // hex for WEGLD-bd4d79
const COLS_TOKEN_ID = '434f4c532d396439316237'; // hex for COLS-9d91b7
const SWAP_FUNC_HEX = '73776170546f6b656e734669786564496e707574'; // hex for swapTokensFixedInput

function amountToHex(amount: string) {
  const value = new BigNumber(amount).multipliedBy('1e18').toFixed(0);
  let hex = new BigNumber(value).toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

export const BuyCols = () => {
  const { account } = useGetAccountInfo();
  const balanceRaw = account?.balance || '0';
  const balanceEgld = new BigNumber(balanceRaw).dividedBy('1e18').toFixed(6);

  const [wrapSuccess, setWrapSuccess] = useState(false);
  const [wrapLoading, setWrapLoading] = useState(false);
  const [wrapError, setWrapError] = useState<string | null>(null);

  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  // Store wrapped amount from user input for swap step
  const [wrappedAmount, setWrappedAmount] = useState<string>('1');

  // Step 1: Wrap eGLD to WEGLD
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
      setWrappedAmount(amount); // Save amount for swap
      setWrapSuccess(true);
      onClose();
    } catch (e: any) {
      setWrapError(e?.message || 'Failed to wrap eGLD');
    }
    setWrapLoading(false);
  };

  // Step 2: Swap WEGLD to COLS using method call with encoded input data
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
    <div className={styles.wrapper} style={{ marginTop: 24 }}>
      <Action
        title="Swap eGLD to COLS"
        description="Enter the amount of eGLD you want to swap to COLS."
        disabled={wrapLoading}
        trigger={
          <div
            className={classNames(styles.trigger, {
              [styles.disabled]: wrapLoading
            })}
            style={{ fontWeight: 700, fontSize: 16 }}
          >
            Swap eGLD to COLS
          </div>
        }
        render={(onClose: () => void) => (
          <div className={styles.delegate}>
            <Formik
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
                    'max-balance',
                    `Amount cannot exceed your wallet balance (${balanceEgld} eGLD).`,
                    (value = '') => {
                      try {
                        return new BigNumber(value).lte(balanceEgld);
                      } catch {
                        return false;
                      }
                    }
                  )
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
                  <form onSubmit={handleSubmit} style={{ position: 'relative' }}>
                    <div className={styles.field}>
                      <label htmlFor="amount">eGLD Amount</label>
                      <div className={styles.group} style={{ position: 'relative' }}>
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
                        />
                        <button
                          type="button"
                          onClick={onMaxClick}
                          className={styles.maxButton}
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: '#303234',
                            color: '#fff',
                            borderRadius: 6,
                            border: 'none',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 14
                          }}
                          disabled={wrapLoading}
                        >
                          Max
                        </button>
                      </div>
                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>
                    {wrapError && (
                      <span className={styles.error}>{wrapError}</span>
                    )}
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
        <div style={{ marginTop: 24, textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className={classNames(styles.trigger, {
              [styles.disabled]: swapLoading
            })}
            onClick={handleSwapClick}
            disabled={swapLoading}
            style={{ fontWeight: 700, fontSize: 16, width: 180 }}
          >
            {swapLoading ? 'Completing...' : 'Complete Swap'}
          </button>
        </div>
      )}
      {swapError && (
        <div className={styles.error} style={{ marginTop: 8, textAlign: 'center' }}>
          {swapError}
        </div>
      )}
    </div>
  );
};
