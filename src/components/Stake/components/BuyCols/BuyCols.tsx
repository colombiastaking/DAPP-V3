import { useState } from 'react';
import { Formik } from 'formik';
import { object, string } from 'yup';
import BigNumber from 'bignumber.js';
import classNames from 'classnames';
import { sendTransactions } from 'helpers/sendTransactions';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';

import { Action, Submit } from 'components/Action';
import styles from './styles.module.scss';

const XOXNO_AGGREGATOR = 'erd1qqqqqqqqqqqqqpgq5rf2sppxk2xu4m0pkmugw2es4gak3rgjah0sxvajva';
const XOXNO_API = 'https://swap.xoxno.com';
const COLS_TOKEN_ID = 'COLS-9d91b7';

// Only EGLD is supported for now
const TOKENS = [
  { id: 'EGLD', symbol: 'EGLD', decimals: 18, name: 'MultiversX (EGLD)', isNative: true },
];

interface Quote {
  from: string;
  to: string;
  amountIn: string;
  amountInShort: number;
  amountOut: string;
  amountOutShort: number;
  amountOutMin: string;
  amountOutMinShort: number;
  slippage: number;
  priceImpact: number;
  rate: string;
  txData: string;
  estimatedBuiltinCalls?: number;
}

async function getQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<Quote> {
  const token = TOKENS.find(t => t.id === tokenIn);
  const decimals = token?.decimals || 18;
  const amountWei = new BigNumber(amountIn).multipliedBy(new BigNumber(10).pow(decimals)).toFixed(0);

  const response = await fetch(
    `${XOXNO_API}/api/v1/quote?from=${tokenIn}&to=${tokenOut}&amountIn=${amountWei}&slippage=0.01`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get quote');
  }

  return response.json();
}

export const BuyCols = () => {
  const account = useGetAccount();
  const balanceRaw = account?.balance || '0';
  const balanceEgld = new BigNumber(balanceRaw).dividedBy('1e18').toFixed(4);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selectedToken] = useState('EGLD');

  const handleSwap = async (amount: string, onClose: () => void) => {
    setError(null);
    setLoading(true);
    setSuccess(false);
    
    try {
      const token = TOKENS.find(t => t.id === selectedToken);
      if (!token) throw new Error('Invalid token');

      // Get quote from XOXNO
      const quoteData = await getQuote(selectedToken, COLS_TOKEN_ID, amount);
      setQuote(quoteData);

      // Calculate gas limit - XOXNO swaps need high gas due to multiple DEX interactions
      const baseGas = 100000000; // 100M base for complex swaps
      const perCallGas = 10000000; // 10M per swap operation
      const estimatedCalls = 5; // Optimized estimate for multi-hop swaps
      const gasLimit = baseGas + (estimatedCalls * perCallGas);

      // Get amount in wei
      const amountWei = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(token.decimals)).toFixed(0);

      // EGLD: Use txData directly, send value with transaction
      await sendTransactions({
        transactions: [
          {
            value: amountWei,
            data: quoteData.txData,
            receiver: XOXNO_AGGREGATOR,
            gasLimit: gasLimit
          }
        ],
        transactionsDisplayInfo: {
          processingMessage: 'Swapping EGLD to COLS...',
          successMessage: 'Swap completed!',
          errorMessage: 'Swap failed'
        }
      });
      
      setSuccess(true);
      onClose();
    } catch (e: any) {
      console.error('Swap error:', e);
      setError(e?.message || 'Failed to swap');
    }
    setLoading(false);
  };

  // Fetch quote when amount changes
  const handleAmountChange = async (amount: string, setFieldValue: (field: string, value: any) => void) => {
    setFieldValue('amount', amount);
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }
    try {
      const quoteData = await getQuote(selectedToken, COLS_TOKEN_ID, amount);
      setQuote(quoteData);
    } catch (e) {
      console.error('Quote error:', e);
      setQuote(null);
    }
  };


  const getTokenBalance = (): string => {
    return balanceEgld || '0';
  };

  return (
    <div className={styles.buySection}>
      <div className={styles.swapHeader}>
        <span className={styles.swapIcon}>💱</span>
        <div>
          <h3 className={styles.swapTitle}>Get COLS</h3>
          <p className={styles.swapDesc}>Swap EGLD to COLS via XOXNO</p>
        </div>
      </div>

      <Action
        title="Swap to COLS"
        description="Exchange EGLD for COLS tokens using XOXNO aggregator for best rates."
        disabled={loading}
        trigger={
          <div
            className={classNames(styles.trigger, styles.triggerSecondary, {
              [styles.disabled]: loading
            })}
          >
            <span className={styles.triggerIcon}>⚡</span>
            <span className={styles.triggerLabel}>Swap → COLS</span>
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
                  .test('max-balance', `Amount cannot exceed your balance.`, (value = '') => {
                    const balance = getTokenBalance();
                    if (!balance || balance === '0') return true;
                    try {
                      return new BigNumber(value).lte(balance);
                    } catch {
                      return false;
                    }
                  })
              })}
              initialValues={{ amount: '1' }}
              onSubmit={({ amount }) => handleSwap(amount, onClose)}
            >
              {({
                errors,
                values,
                touched,
                handleBlur,
                handleSubmit,
                setFieldValue
              }) => {
                const onMaxClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  const maxAmount = getTokenBalance();
                  if (maxAmount && maxAmount !== '0') {
                    setFieldValue('amount', maxAmount);
                    handleAmountChange(maxAmount, setFieldValue);
                  }
                };

                return (
                  <form onSubmit={handleSubmit}>
                    {/* Amount Input */}
                    <div className={styles.field}>
                      <label htmlFor="amount" className={styles.label}>
                        Amount (EGLD)
                      </label>
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
                          onChange={(e) => handleAmountChange(e.target.value, setFieldValue)}
                          className={classNames(styles.input, {
                            [styles.invalid]: errors.amount && touched.amount
                          })}
                          placeholder="0.00"
                        />
                        <button
                          type="button"
                          onClick={onMaxClick}
                          className={styles.maxButton}
                          disabled={loading}
                        >
                          MAX
                        </button>
                      </div>
                      <div className={styles.balance}>
                        Available: <span>{getTokenBalance()} EGLD</span>
                      </div>
                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>

                    {/* Quote Display */}
                    {quote && (
                      <div className={styles.quoteDisplay}>
                        <div className={styles.quoteRow}>
                          <span>You get:</span>
                          <span className={styles.quoteValue}>
                            {quote.amountOutShort} COLS
                          </span>
                        </div>
                        <div className={styles.quoteRow}>
                          <span>Min. you'll get:</span>
                          <span className={styles.quoteValueSmall}>
                            {quote.amountOutMinShort} COLS
                          </span>
                        </div>
                        <div className={styles.quoteRow}>
                          <span>Rate:</span>
                          <span>1 EGLD = {quote.rate} COLS</span>
                        </div>
                        <div className={styles.quoteRow}>
                          <span>Price impact:</span>
                          <span className={quote.priceImpact > 5 ? styles.quoteWarning : ''}>
                            {quote.priceImpact.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}

                    {error && <span className={styles.error}>{error}</span>}
                    <Submit
                      save={loading ? 'Swapping...' : 'Swap'}
                      onClose={() => {
                        setFieldValue('amount', '1');
                        setError(null);
                        setQuote(null);
                      }}
                    />
                  </form>
                );
              }}
            </Formik>
          </div>
        )}
      />

      {success && (
        <div className={styles.stepTwo}>
          <div className={styles.stepTwoInfo}>
            <span>✅ Swap completed! You received COLS tokens.</span>
          </div>
        </div>
      )}
    </div>
  );
};
