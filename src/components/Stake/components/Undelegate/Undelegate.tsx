import { ChangeEvent, useEffect, useState } from 'react';
import { useGetActiveTransactionsStatus } from 'hooks/useTransactionStatus';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import classNames from 'classnames';
import { Formik } from 'formik';
import { object, string } from 'yup';
import { decodeBigNumber, ContractFunction, Address, AddressValue } from '@multiversx/sdk-core';
import { createContractQuery } from 'helpers/contractQuery';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';

import { Action, Submit } from 'components/Action';
import useStakeData, { ActionCallbackType } from 'components/Stake/hooks';
import { network } from 'config';
import { useColsAprContext } from 'context/ColsAprContext';
import { AnimatedDots } from 'components/AnimatedDots';

import styles from './styles.module.scss';

const DELEGATION_CONTRACT = 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf';

export const Undelegate = () => {
  const { onUndelegate } = useStakeData();
  const { pending } = useGetActiveTransactionsStatus();
  const account = useGetAccount();
  const address = account.address;
  const { stakers, loading: stakersLoading } = useColsAprContext();
  
  const [additionalEgldDelegated, setAdditionalEgldDelegated] = useState<string | null>(null);
  const [loadingAdditionalEgld, setLoadingAdditionalEgld] = useState(false);

  // Get user row from stakers
  const userRow = stakers.find((s: any) => s.address === address) ?? null;
  const colsStaked = userRow?.colsStaked ?? 0;
  const egldFromStakers = userRow?.egldStaked ?? 0;

  // Get delegated eGLD from stakers data first, then blockchain if no COLS
  let delegatedEgld: number;
  let delegatedLoading: boolean;

  if (colsStaked > 0) {
    // User has COLS staked - use stakers data
    delegatedEgld = Number(egldFromStakers);
    delegatedLoading = stakersLoading;
  } else {
    // No COLS staked - use blockchain query
    delegatedEgld = additionalEgldDelegated !== null 
      ? Number(additionalEgldDelegated) / 1e18 
      : 0;
    delegatedLoading = loadingAdditionalEgld;
  }

  // Fetch delegated eGLD from blockchain if no COLS staked
  useEffect(() => {
    let mounted = true;
    
    if (!address || colsStaked > 0) {
      setAdditionalEgldDelegated(null);
      setLoadingAdditionalEgld(false);
      return () => { mounted = false; };
    }

    setLoadingAdditionalEgld(true);

    async function fetchDelegatedEgld() {
      try {
        const provider = new ProxyNetworkProvider(network.gatewayAddress);
        const q = createContractQuery({
          address: new Address(DELEGATION_CONTRACT),
          func: new ContractFunction('getUserActiveStake'),
          args: [new AddressValue(new Address(address))]
        });

        const response = await provider.queryContract(q);
        const parts = response.getReturnDataParts();

        if (parts.length > 0) {
          const raw = decodeBigNumber(parts[0]).toFixed();
          if (mounted) setAdditionalEgldDelegated(raw);
        } else {
          if (mounted) setAdditionalEgldDelegated('0');
        }
      } catch (e) {
        console.error('Failed to fetch delegated eGLD:', e);
        if (mounted) setAdditionalEgldDelegated('0');
      }
      if (mounted) setLoadingAdditionalEgld(false);
    }

    fetchDelegatedEgld();
    return () => { mounted = false; };
  }, [address, colsStaked]);

  // Validation schema
  const validationSchema = object().shape({
    amount: string()
      .required('Required')
      .test('minimum', 'Value must be greater than zero.', (value = '0') => {
        const num = Number(value);
        return !isNaN(num) && num > 0;
      })
      .test('max', 'Amount exceeds your delegated balance.', (value = '0') => {
        const num = Number(value);
        return !isNaN(num) && num <= delegatedEgld;
      })
  });

  return (
    <div className={classNames(styles.wrapper, 'undelegate-wrapper')}>
      <Action
        title='Undelegate eGLD'
        description={`Enter the amount of ${network.egldLabel} you want to undelegate. Your funds will be available after the unbonding period.`}
        disabled={pending}
        trigger={
          <div
            className={classNames(styles.trigger, styles.triggerWarning, {
              [styles.disabled]: pending
            })}
          >
            <span className={styles.triggerIcon}>🔓</span>
            <span className={styles.triggerLabel}>Undelegate</span>
          </div>
        }
        render={(callback: ActionCallbackType) => (
          <div className={styles.undelegate}>
            <Formik
              validationSchema={validationSchema}
              onSubmit={onUndelegate(callback)}
              initialValues={{
                amount: '0'
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
                const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
                  handleChange(event);
                };

                const onMaxClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  setFieldValue('amount', delegatedEgld.toFixed(6));
                };

                return (
                  <form onSubmit={handleSubmit}>
                    <div className={styles.field}>
                      <label htmlFor='amount' className={styles.label}>
                        {network.egldLabel} Amount to Undelegate
                      </label>
                      <div className={styles.inputWrapper}>
                        <input
                          type='number'
                          name='amount'
                          step='any'
                          required={true}
                          autoComplete='off'
                          min={0.000000000000000001}
                          value={values.amount}
                          onBlur={handleBlur}
                          onChange={onChange}
                          className={classNames(styles.input, {
                            [styles.invalid]: errors.amount && touched.amount
                          })}
                          placeholder="0.00"
                        />
                        <button
                          type='button'
                          onClick={onMaxClick}
                          className={styles.maxButton}
                          disabled={pending || delegatedEgld === 0 || delegatedLoading}
                        >
                          MAX
                        </button>
                      </div>
                      <div className={styles.balance}>
                        Delegated: <span>
                          {delegatedLoading ? <AnimatedDots /> : delegatedEgld.toFixed(6)} {network.egldLabel}
                        </span>
                      </div>
                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>

                    <Submit
                      save='Undelegate Now'
                      onClose={() => {
                        setFieldValue('amount', '0');
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