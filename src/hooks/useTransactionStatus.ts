/**
 * Compatibility hook for SDK v5 migration
 * Provides the old useGetActiveTransactionsStatus API using the new hooks
 */
import { useGetSuccessfulTransactions } from '@multiversx/sdk-dapp/out/react/transactions/useGetSuccessfulTransactions';
import { useGetPendingTransactions } from '@multiversx/sdk-dapp/out/react/transactions/useGetPendingTransactions';

export interface TransactionStatus {
  hasSuccessfulTransactions: boolean;
  successfulTransactionsArray: any[];
  hasPendingTransactions: boolean;
  pendingTransactionsArray: any[];
  pending: boolean;
  success: boolean;
}

export const useGetActiveTransactionsStatus = (): TransactionStatus => {
  const successfulTransactions = useGetSuccessfulTransactions();
  const pendingTransactions = useGetPendingTransactions();

  return {
    hasSuccessfulTransactions: successfulTransactions.length > 0,
    successfulTransactionsArray: successfulTransactions,
    hasPendingTransactions: pendingTransactions.length > 0,
    pendingTransactionsArray: pendingTransactions,
    pending: pendingTransactions.length > 0,
    success: successfulTransactions.length > 0
  };
};

export default useGetActiveTransactionsStatus;