import { Address, Transaction } from '@multiversx/sdk-core';
import { TransactionManager } from '@multiversx/sdk-dapp/out/managers/TransactionManager';
import { getAccountProvider } from '@multiversx/sdk-dapp/out/providers/helpers/accountProvider';
import { getAccount } from '@multiversx/sdk-dapp/out/methods/account/getAccount';
import { getNetworkConfig } from '@multiversx/sdk-dapp/out/methods/network/getNetworkConfig';

interface TransactionInput {
  value?: string;
  data?: string;
  receiver: string;
  gasLimit: number;
}

interface SendTransactionsOptions {
  transactions: TransactionInput[];
  transactionsDisplayInfo?: {
    processingMessage?: string;
    errorMessage?: string;
    successMessage?: string;
  };
}

/**
 * Drop-in replacement for the old sendTransactions from SDK v2.x
 * Uses the new SDK v5 transaction flow internally
 */
export const sendTransactions = async (options: SendTransactionsOptions) => {
  const { transactions, transactionsDisplayInfo } = options;
  
  const account = getAccount();
  const networkConfig = getNetworkConfig();

  // Convert old transaction format to new Transaction objects
  const newTransactions = transactions.map((tx) => {
    // Handle value - can be string number or TokenPayment
    let valueBigInt: bigint;
    if (typeof tx.value === 'string') {
      // Check if it's already a hex or decimal number
      if (tx.value?.startsWith('0x') || tx.value?.startsWith('0X')) {
        valueBigInt = BigInt(tx.value);
      } else {
        valueBigInt = BigInt(tx.value || '0');
      }
    } else {
      valueBigInt = BigInt((tx.value as any)?.valueOf?.() || 0);
    }

    return new Transaction({
      value: valueBigInt,
      data: Buffer.from(tx.data || ''),
      receiver: new Address(tx.receiver),
      gasLimit: BigInt(tx.gasLimit),
      gasPrice: BigInt(1000000000),
      chainID: networkConfig.network.chainId,
      nonce: BigInt(account.nonce),
      sender: Address.newFromBech32(account.address),
      version: 1
    });
  });

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

export default sendTransactions;