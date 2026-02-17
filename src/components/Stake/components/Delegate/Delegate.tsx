import { useGetActiveTransactionsStatus } from 'hooks/useTransactionStatus';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import classNames from 'classnames';
import { Formik } from 'formik';
import { object, string } from 'yup';

import { Action, Submit } from 'components/Action';
import useStakeData, { ActionCallbackType } from 'components/Stake/hooks';
import { network } from 'config';

import styles from './styles.module.scss';

export const Delegate = () => {
  const { onDelegate } = useStakeData();
  const { pending } = useGetActiveTransactionsStatus();
  const account = useGetAccount();

  // Parse eGLD balance from account (string in smallest unit)
  const balanceRaw = account?.balance || '0';
  const balanceEgld = Number(balanceRaw) / 1e18;

  // Minimum delegation amount is 1 eGLD
  const minAmount = 1;

  // Validation schema
  const validationSchema = object().shape({
    amount: string()
      .required('Required')
      .test('minimum', `Value must be greater than or equal to ${minAmount}.`, (value = '0') => {
        const num = Number(value);
        return !isNaN(num) && num >= minAmount;
      })
  });

  return (
    <div className={`${styles.wrapper} delegate-wrapper`}>
      <Action
        title='Delegate eGLD'
        description={`Enter the amount of ${network.egldLabel} you want to delegate to Colombia Staking.`}
        disabled={pending}
        trigger={
          <div
            className={classNames(styles.trigger, styles.triggerPrimary, {
              [styles.disabled]: pending
            })}
          >
            <span className={styles.triggerIcon}>⚡</span>
            <span className={styles.triggerLabel}>Delegate</span>
          </div>
        }
        render={(onClose: ActionCallbackType) => (
          <div className={styles.delegate}>
            <Formik
              validationSchema={validationSchema}
              onSubmit={onDelegate(onClose)}
              initialValues={{
                amount: minAmount.toString()
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
                const onMaxClick = (event: React.MouseEvent<HTMLButtonElement>) => {
                  event.preventDefault();
                  setFieldValue('amount', balanceEgld.toFixed(6));
                };

                return (
                  <form onSubmit={handleSubmit}>
                    <div className={styles.field}>
                      <label htmlFor='amount' className={styles.label}>
                        {network.egldLabel} Amount
                      </label>
                      <div className={styles.inputWrapper}>
                        <input
                          type='number'
                          name='amount'
                          step='any'
                          required={true}
                          autoComplete='off'
                          min={minAmount}
                          value={values.amount}
                          onBlur={handleBlur}
                          onChange={handleChange}
                          className={classNames(styles.input, {
                            [styles.invalid]: errors.amount && touched.amount
                          })}
                          placeholder="0.00"
                        />
                        <button
                          type='button'
                          onClick={onMaxClick}
                          className={styles.maxButton}
                          disabled={pending}
                        >
                          MAX
                        </button>
                      </div>
                      <div className={styles.balance}>
                        Available: <span>{balanceEgld.toFixed(6)} {network.egldLabel}</span>
                      </div>
                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>

                    <Submit
                      save='Delegate Now'
                      onClose={() => {
                        setFieldValue('amount', minAmount.toString());
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