import { parseAmount } from 'helpers/parseAmount';

import BigNumber from 'bignumber.js';
import { string } from 'yup';
import { network, denomination } from 'config';
import { denominated } from 'helpers/denominate';

const delegateValidator = (input: string, limit: string) =>
  string()
    .required('Required')
    .test('minimum', 'Value must be greater than zero.', (value = '0') =>
      new BigNumber(parseAmount(value, denomination)).isGreaterThanOrEqualTo(1)
    )
    .test(
      'maximum',
      function (value = '0') {
        if (!input || new BigNumber(input).isLessThanOrEqualTo(0)) {
          return this.createError({ message: `Invalid balance` });
        }
        // Allow tiny margin for floating point errors
        const maxAllowed = new BigNumber(input).plus('0.000001');
        return new BigNumber(parseAmount(value, denomination)).isLessThanOrEqualTo(maxAllowed);
      }
    )
    .test(
      'uncapable',
      `Max delegation cap reached. That is the maximum amount you can delegate: ${denominated(
        limit
      )} ${network.egldLabel}`,
      (value = '0') =>
        new BigNumber(parseAmount(value, denomination)).isLessThanOrEqualTo(limit)
    );

export { delegateValidator };
