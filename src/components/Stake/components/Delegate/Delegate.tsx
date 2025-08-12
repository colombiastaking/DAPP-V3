import { useGetActiveTransactionsStatus } from '@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus';
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

  // Validation schema: require number >= 1
  const validationSchema = object().shape({
    amount: string()
      .required('Required')
      .test('minimum', 'Value must be greater than or equal to 1.', (value = '0') => {
        const num = Number(value);
        return !isNaN(num) && num >= 1;
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
                amount: '1'
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
                return (
                  <form onSubmit={handleSubmit}>
                    <div className={styles.field}>
                      <label htmlFor='amount'>{network.egldLabel} Amount</label>
                      <div className={styles.group}>
                        <input
                          type='number'
                          name='amount'
                          step='any'
                          required={true}
                          autoComplete='off'
                          min={1}
                          value={values.amount}
                          onBlur={handleBlur}
                          onChange={handleChange}
                          className={classNames(styles.input, {
                            [styles.invalid]: errors.amount && touched.amount
                          })}
                        />
                      </div>

                      {errors.amount && touched.amount && (
                        <span className={styles.error}>{errors.amount}</span>
                      )}
                    </div>

                    <Submit
                      save='Continue'
                      onClose={() => {
                        setFieldValue('amount', '1');
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
