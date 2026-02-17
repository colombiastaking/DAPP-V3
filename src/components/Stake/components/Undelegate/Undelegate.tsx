import { ChangeEvent } from 'react';
import { useGetActiveTransactionsStatus } from '@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus';
import classNames from 'classnames';
import { Formik } from 'formik';
import { object, string } from 'yup';

import { Action, Submit } from 'components/Action';
import useStakeData, { ActionCallbackType } from 'components/Stake/hooks';
import { network } from 'config';
import { useGlobalContext } from 'context';

import styles from './styles.module.scss';

export const Undelegate = () => {
  const { onUndelegate } = useStakeData();
  const { pending } = useGetActiveTransactionsStatus();
  const { userActiveStake } = useGlobalContext();

  // Use delegated eGLD amount from global context
  const delegatedRaw = userActiveStake.data || '0';
  let delegatedEgld = 0;
  try {
    const num = Number(delegatedRaw);
    delegatedEgld = !isNaN(num) && num > 0 ? num / 1e18 : 0;
  } catch {
    delegatedEgld = 0;
  }

  // Validation schema
  const validationSchema = object().shape({
    amount: string()
      .required('Required')
      .test('minimum', 'Value must be greater than zero.', (value = '0') => {
        const num = Number(value);
        return !isNaN(num) && num > 0;
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
                          disabled={pending || delegatedEgld === 0}
                        >
                          MAX
                        </button>
                      </div>
                      <div className={styles.balance}>
                        Delegated: <span>{delegatedEgld.toFixed(6)} {network.egldLabel}</span>
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