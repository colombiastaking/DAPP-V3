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

// Fix import path here (correct relative path)
import styles from '../../components/Stake/components/StakeCols/styles.module.scss';

const COLS_TOKEN_ID = 'COLS-9d91b7';
const COLS_TOKEN_ID_HEX = '434f4c532d396439316237';
const STAKE_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const GAS_LIMIT = 15000000;

function amountToHex(amount: string) {
  const value = new BigNumber(amount).multipliedBy('1e18').toFixed(0);
  let hex = new BigNumber(value).toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  return hex;
}

export const MigrationStakeCols = ({
  requiredCols,
  onStaked
}: {
  requiredCols: number;
  onStaked: () => void;
}) => {
  const account = useGetAccount();
  const address = account.address;
  const { pending } = useGetActiveTransactionsStatus();
  const [colsBalance, setColsBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCols = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `${network.apiAddress}/accounts/${address}/tokens?identifier=${COLS_TOKEN_ID}`
        );
        if (Array.isArray(data) && data.length > 0 && data[0].identifier === COLS_TOKEN_ID) {
          let raw = data[0].balance.padStart(19, '0');
          const intPart = raw.slice(0, -18) || '0';
          let decPart = raw.slice(-18).replace(/0+$/, '');
          const formattedCols = decPart ? `${intPart}.${decPart}` : intPart;
          setColsBalance(formattedCols);
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

  const handleStakeSubmit = async (amount: string, onClose: () => void) => {
    setError(null);
    try {
      const amountHex = amountToHex(amount);
      const data = [
        'ESDTTransfer',
        COLS_TOKEN_ID_HEX,
        amountHex,
        '7374616b65', // "stake" in hex
        '00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787' // fixed address
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
      onStaked();
    } catch (e: any) {
      setError(e?.message || 'Failed to send transaction');
    }
  };

  return (
    <div className={styles.wrapper}>
      <Action
        title="Stake COLS"
        description={`You need to stake at least ${requiredCols} COLS tokens to proceed with migration.`}
        disabled={pending}
        trigger={
          <div
            className={classNames(styles.trigger, {
              [styles.disabled]: pending
            })}
            style={{ fontWeight: 700, fontSize: 16 }}
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
                    'min-required',
                    `You must stake at least ${requiredCols} COLS.`,
                    (value = '') => {
                      try {
                        return new BigNumber(value).isGreaterThanOrEqualTo(requiredCols);
                      } catch {
                        return false;
                      }
                    }
                  )
                  .test(
                    'max-balance',
                    `You cannot stake more than your COLS balance (${colsBalance}).`,
                    (value = '') => {
                      try {
                        return new BigNumber(value).lte(colsBalance || '0');
                      } catch {
                        return false;
                      }
                    }
                  )
              })}
              initialValues={{ amount: requiredCols.toString() }}
              onSubmit={({ amount }) => handleStakeSubmit(amount, onClose)}
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
                          min={requiredCols}
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
                        setFieldValue('amount', requiredCols.toString());
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
    </div>
  );
};
