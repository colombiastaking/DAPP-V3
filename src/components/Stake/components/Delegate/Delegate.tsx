import { useGetActiveTransactionsStatus } from '@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
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
  const { account } = useGetAccountInfo();

  // Parse eGLD balance from account (string in smallest unit)
  const balanceRaw = account?.balance || '0';
  const balanceEgld = Number(balanceRaw) / 1e18;

  // Minimum delegation amount is 1 eGLD
  const minAmount = 1;

  // Validation schema: only require number >= 1, no max limit
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
        description={`Enter the amount of ${network.egldLabel} you want to delegate.`}
        disabled={pending}
        trigger={
          <div
            className={classNames(styles.trigger, {
              [styles.disabled]: pending
            })}
          >
            Delegate eGLD
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
                      <label htmlFor='amount'>{network.egldLabel} Amount</label>
                      <div className={styles.group} style={{ position: 'relative' }}>
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
                        />
                        <button
                          type='button'
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
                          disabled={pending}
                        >
                          Max
                        </button>
                      </div>

                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>

                    <Submit
                      save='Continue'
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
