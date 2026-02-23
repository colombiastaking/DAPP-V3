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

// Common tokens on MultiversX
const TOKENS = [
  { id: 'EGLD', symbol: 'EGLD', decimals: 18, name: 'MultiversX (EGLD)' },
  { id: 'WEGLD-bd4d79', symbol: 'WEGLD', decimals: 18, name: 'Wrapped EGLD' },
  { id: 'USDC-c76f1f', symbol: 'USDC', decimals: 6, name: 'USD Coin' },
  { id: 'USDT-37f331', symbol: 'USDT', decimals: 6, name: 'Tether USD' },
  { id: 'MEX-455c57', symbol: 'MEX', decimals: 18, name: 'MEX Token' },
  { id: 'WBTC-38fdb7', symbol: 'WBTC', decimals: 8, name: 'Wrapped Bitcoin' },
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
  // Convert decimal amount to wei (smallest units)
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

// Convert amount to hex for ESDT transfers
function toHex(amount: string, decimals: number): string {
  const value = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(decimals)).toFixed(0);
  return new BigNumber(value).toString(16);
}

export const BuyCols = () => {
  const account = useGetAccount();
  const balanceRaw = account?.balance || '0';
  const balanceEgld = new BigNumber(balanceRaw).dividedBy('1e18').toFixed(4);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selectedToken, setSelectedToken] = useState('EGLD');

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
      // Use conservative estimate since API doesn't always return estimatedBuiltinCalls
      const baseGas = 100000000; // 100M base for complex swaps
      const perCallGas = 10000000; // 10M per swap operation
      const estimatedCalls = 6; // Conservative estimate for multi-hop swaps
      const gasLimit = baseGas + (estimatedCalls * perCallGas);

      // Get amount in wei
      const amountWei = new BigNumber(amount).multipliedBy(new BigNumber(10).pow(token.decimals)).toFixed(0);

      if (selectedToken === 'EGLD') {
        // For EGLD: Use txData directly, send value with transaction
        // XOXNO handles wrapping internally
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
      } else {
        // For ESDT tokens: Use ESDTTransfer format
        // Format: ESDTTransfer@tokenIdentifier@amount@txData
        const tokenId = selectedToken.split('-')[0]; // e.g., "USDC" from "USDC-c76f1f"
        const tokenHex = Buffer.from(tokenId).toString('hex');
        const amountHex = toHex(amount, token.decimals);
        
        // The txData from XOXNO is the raw swap payload - prepend it to ESDTTransfer
        const esdtTxData = `ESDTTransfer@${tokenHex}@${amountHex}@${quoteData.txData}`;

        await sendTransactions({
          transactions: [
            {
              value: '0',
              data: esdtTxData,
              receiver: XOXNO_AGGREGATOR,
              gasLimit: gasLimit
            }
          ],
          transactionsDisplayInfo: {
            processingMessage: 'Swapping to COLS...',
            successMessage: 'Swap completed!',
            errorMessage: 'Swap failed'
          }
        });
      }
      
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

  const selectedTokenData = TOKENS.find(t => t.id === selectedToken);

  // Get token-specific balance
  const getTokenBalance = () => {
    if (selectedToken === 'EGLD') {
      return balanceEgld;
    }
    // For other tokens, we'd need to fetch balances - default to 0 for now
    return '0';
  };

  return (
    <div className={styles.buySection}>
      <div className={styles.swapHeader}>
        <span className={styles.swapIcon}>💱</span>
        <div>
          <h3 className={styles.swapTitle}>Get COLS</h3>
          <p className={styles.swapDesc}>Swap any token to COLS via XOXNO</p>
        </div>
      </div>

      <Action
        title="Swap to COLS"
        description="Exchange any token for COLS tokens using XOXNO aggregator for best rates."
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
                    try {
                      return new BigNumber(value).lte(getTokenBalance() || '0');
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
                  setFieldValue('amount', maxAmount);
                  handleAmountChange(maxAmount, setFieldValue);
                };

                return (
                  <form onSubmit={handleSubmit}>
                    {/* Token Selector */}
                    <div className={styles.field}>
                      <label className={styles.label}>From Token</label>
                      <select
                        value={selectedToken}
                        onChange={(e) => {
                          setSelectedToken(e.target.value);
                          setQuote(null);
                        }}
                        className={styles.select}
                      >
                        {TOKENS.map(token => (
                          <option key={token.id} value={token.id}>
                            {token.symbol} - {token.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Amount Input */}
                    <div className={styles.field}>
                      <label htmlFor="amount" className={styles.label}>
                        Amount ({selectedTokenData?.symbol})
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
                        Available: <span>{getTokenBalance()} {selectedTokenData?.symbol}</span>
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
                          <span>1 {selectedTokenData?.symbol} = {quote.rate} COLS</span>
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
