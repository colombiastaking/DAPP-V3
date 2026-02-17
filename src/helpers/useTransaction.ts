import { Address, Transaction } from '@multiversx/sdk-core';
import { TransactionManager } from '@multiversx/sdk-dapp/out/managers/TransactionManager';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { refreshAccount } from '@multiversx/sdk-dapp/out/utils/account/refreshAccount';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useGetNetworkConfig } from '@multiversx/sdk-dapp/out/react/network/useGetNetworkConfig';
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
  gasLimit?: number;
}

// Convert eGLD amount to smallest unit (wei)
function egldToWei(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(18, '0').slice(0, 18);
  return BigInt(whole + paddedFraction);
}

const useTransaction = () => {
  const account = useGetAccount();
  const { network: networkConfig } = useGetNetworkConfig();

  const sendTransaction = async ({
    args,
    value,
    type,
    gasLimit
  }: TransactionParametersType) => {
    const address = new Address(network.delegationContract);
    const delegable = delegationContractData.find(
      (item: DelegationContractType) => item.name === type
    );

    if (!delegable) {
      throw new Error('The contract for this action is not defined.');
    }

    const getFunctionName = (): string =>
      args === '' ? delegable.data : `${delegable.data}${args}`;

    const getGasLimit = (): number => {
      if (gasLimit !== undefined) {
        return gasLimit;
      }
      const nodeKeys = args.split('@').slice(1);
      return delegable.gasLimit * (nodeKeys.length / 2);
    };

    const transaction = new Transaction({
      value: egldToWei(value),
      data: Buffer.from(getFunctionName()),
      receiver: address,
      gasLimit: BigInt(getGasLimit()),
      gasPrice: BigInt(1000000000), // Standard gas price
      chainID: networkConfig.chainId,
      nonce: BigInt(account.nonce),
      sender: Address.newFromBech32(account.address),
      version: 1
    });

    // Refresh account to get latest nonce before signing
    await refreshAccount();

    // Get the provider and sign transactions
    const provider = getAccountProvider();
    const signedTransactions = await provider.signTransactions([transaction]);

    // Send and track transactions
    const txManager = TransactionManager.getInstance();
    const sentTransactions = await txManager.send(signedTransactions);

    const sessionId = await txManager.track(sentTransactions, {
      transactionsDisplayInfo: {
        processingMessage: 'Processing transaction...',
        errorMessage: 'Transaction failed',
        successMessage: 'Transaction successful'
      }
    });

    // Notify listeners that a transaction completed so APR table can refresh
    notifyTxCompleted();

    return { sessionId, sentTransactions };
  };

  return {
    sendTransaction
  };
};

export default useTransaction;
