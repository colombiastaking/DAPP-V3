import { Address, SmartContract, TokenPayment } from '@multiversx/sdk-core';
import { sendTransactions } from '@multiversx/sdk-dapp/services/transactions/sendTransactions';
import {
  network,
  DelegationContractType,
  delegationContractData
} from 'config';
import { notifyTxCompleted } from 'utils/txEvents';

interface TransactionParametersType {
  args: string;
  value: string;
  type: string;
  gasLimit?: number; // Added optional gasLimit property here
}

const useTransaction = () => {
  const sendTransaction = async ({
    args,
    value,
    type,
    gasLimit
  }: TransactionParametersType) => {
    const address = new Address(network.delegationContract);
    const contract = new SmartContract({ address });
    const delegable = delegationContractData.find(
      (item: DelegationContractType) => item.name === type
    );

    if (!delegable) {
      throw new Error('The contract for this action is not defined.');
    } else {
      const getFunctionName = (): string =>
        args === '' ? delegable.data : `${delegable.data}${args}`;

      const getGasLimit = (): number => {
        if (gasLimit !== undefined) {
          return gasLimit;
        }
        const nodeKeys = args.split('@').slice(1);

        return delegable.gasLimit * (nodeKeys.length / 2);
      };

      const transaction = {
        value: TokenPayment.egldFromAmount(value),
        data: getFunctionName(),
        receiver: contract.getAddress().bech32(),
        gasLimit: getGasLimit()
      };

      const result = await sendTransactions({
        transactions: [transaction]
      });

      // Notify listeners that a transaction completed so APR table can refresh
      notifyTxCompleted();

      return result;
    }
  };

  return {
    sendTransaction
  };
};

export default useTransaction;
