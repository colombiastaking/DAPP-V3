import { Address, Transaction } from '@multiversx/sdk-core';
import { TransactionManager } from '@multiversx/sdk-dapp/out/managers/TransactionManager';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { refreshAccount } from '@multiversx/sdk-dapp/out/utils/account/refreshAccount';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useGetNetworkConfig } from '@multiversx/sdk-dapp/out/react/network/useGetNetworkConfig';

interface SendTransactionsOptions {
  transactions: Array<{
    value: string;
    data: string;
    receiver: string;
    gasLimit: number;
  }>;
  transactionsDisplayInfo?: {
    processingMessage?: string;
    errorMessage?: string;
    successMessage?: string;
  };
}

/**
 * Helper hook to send transactions using the new SDK v5 flow
 * Maintains backward compatibility with the old sendTransactions API
 */
export const useSendTransactions = () => {
  const account = useGetAccount();
  const { network: networkConfig } = useGetNetworkConfig();

  const sendTransactions = async (options: SendTransactionsOptions) => {
    const { transactions, transactionsDisplayInfo } = options;

    // Convert old transaction format to new Transaction objects
    const newTransactions = transactions.map((tx) => {
      return new Transaction({
        value: BigInt(tx.value || '0'),
        data: Buffer.from(tx.data || ''),
        receiver: new Address(tx.receiver),
        gasLimit: BigInt(tx.gasLimit),
        gasPrice: BigInt(1000000000),
        chainID: networkConfig.chainId,
        nonce: BigInt(account.nonce),
        sender: Address.newFromBech32(account.address),
        version: 1
      });
    });

    // Refresh account to get latest nonce
    await refreshAccount();

    // Get provider and sign transactions
    const provider = getAccountProvider();
    const signedTransactions = await provider.signTransactions(newTransactions);

    // Send and track transactions
    const txManager = TransactionManager.getInstance();
    const sentTransactions = await txManager.send(signedTransactions);

    const sessionId = await txManager.track(sentTransactions, {
      transactionsDisplayInfo: transactionsDisplayInfo || {
        processingMessage: 'Processing transaction...',
        errorMessage: 'Transaction failed',
        successMessage: 'Transaction successful'
      }
    });

    return { sessionId };
  };

  return { sendTransactions };
};

// Re-export the standalone sendTransactions function
export { sendTransactions } from './sendTransactions';