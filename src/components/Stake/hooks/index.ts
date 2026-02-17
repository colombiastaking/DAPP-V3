import { useEffect, useState } from 'react';

import {
  Address,
  AddressValue,
  ContractFunction,
  decodeBigNumber
} from '@multiversx/sdk-core';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useGetActiveTransactionsStatus } from 'hooks/useTransactionStatus';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import BigNumber from 'bignumber.js';

import { network, minDust } from 'config';
import { useDispatch, useGlobalContext } from 'context';
import { denominated } from 'helpers/denominate';
import getPercentage from 'helpers/getPercentage';
import { nominateValToHex } from 'helpers/nominate';
import useTransaction from 'helpers/useTransaction';
import { createContractQuery } from 'helpers/contractQuery';

export type ActionCallbackType = () => void;
export interface DelegationPayloadType {
  amount: string;
}

const useStakeData = () => {
  const dispatch = useDispatch();
  const [check, setCheck] = useState(false);

  const account = useGetAccount();
  const address = account.address;
  const { sendTransaction } = useTransaction();
  const { pending, hasSuccessfulTransactions, successfulTransactionsArray } =
    useGetActiveTransactionsStatus();
  const { contractDetails, userClaimableRewards, totalActiveStake } =
    useGlobalContext();

  const GAS_LIMIT_UNDELEGATE = 12000000;
  const GAS_LIMIT_CLAIM_REWARDS = 2000000;
  const GAS_LIMIT_REDELEGATE = 12000000;

  const onDelegate =
    (callback: ActionCallbackType) =>
    async (data: DelegationPayloadType): Promise<void> => {
      try {
        await sendTransaction({
          value: data.amount,
          type: 'delegate',
          args: '',
          gasLimit: GAS_LIMIT_UNDELEGATE // Using 12M as delegate gas limit (same as undelegate)
        });

        setTimeout(callback, 250);
      } catch (error) {
        console.error(error);
      }
    };

  const onUndelegate =
    (callback: ActionCallbackType) =>
    async (data: DelegationPayloadType): Promise<void> => {
      try {
        await sendTransaction({
          value: '0',
          type: 'unDelegate',
          args: nominateValToHex(data.amount.toString()),
          gasLimit: GAS_LIMIT_UNDELEGATE
        });

        setTimeout(callback, 250);
      } catch (error) {
        console.error(error);
      }
    };

  const onRedelegate =
    (callback: ActionCallbackType) => async (): Promise<void> => {
      try {
        await sendTransaction({
          value: '0',
          type: 'reDelegateRewards',
          args: '',
          gasLimit: GAS_LIMIT_REDELEGATE
        });

        setTimeout(callback, 250);
      } catch (error) {
        console.error(error);
      }
    };

  const onClaimRewards =
    (callback: ActionCallbackType) => async (): Promise<void> => {
      try {
        await sendTransaction({
          value: '0',
          type: 'claimRewards',
          args: '',
          gasLimit: GAS_LIMIT_CLAIM_REWARDS
        });

        setTimeout(callback, 250);
      } catch (error) {
        console.error(error);
      }
    };

  const getStakingLimits = () => {
    if (contractDetails.data && totalActiveStake.data) {
      const balance = new BigNumber(account.balance);
      const gasPrice = new BigNumber('12000000');
      const gasLimit = new BigNumber('12000000');
      const available = balance.minus(gasPrice.times(gasLimit));
      const dustful = available.minus(new BigNumber(minDust)).toFixed();

      if (contractDetails.data.withDelegationCap === 'true') {
        const cap = contractDetails.data.delegationCap;
        const stake = totalActiveStake.data;
        const remainder = new BigNumber(cap).minus(new BigNumber(stake));
        const maxed =
          parseInt(getPercentage(denominated(stake), denominated(cap))) >= 100;

        if (remainder.isGreaterThan(available)) {
          return {
            balance: available.toFixed(),
            limit: dustful,
            maxed
          };
        } else {
          return {
            balance: available.toFixed(),
            limit: remainder.gt(0) ? remainder.toFixed() : '0',
            maxed
          };
        }
      } else {
        return {
          balance: available.toFixed(),
          limit: dustful,
          maxed: false
        };
      }
    }

    return {
      balance: '',
      limit: ''
    };
  };

  // EXACTLY as in your provided method:
  const getUserClaimableRewards = async (): Promise<void> => {
    dispatch({
      type: 'getUserClaimableRewards',
      userClaimableRewards: {
        status: 'loading',
        data: null,
        error: null
      }
    });

    try {
      const provider = new ProxyNetworkProvider(network.gatewayAddress);
      const query = createContractQuery({
        address: new Address(network.delegationContract),
        func: new ContractFunction('getClaimableRewards'),
        args: [new AddressValue(new Address(address))]
      });

      const data = await provider.queryContract(query);
      const [claimableRewards] = data.getReturnDataParts();

      dispatch({
        type: 'getUserClaimableRewards',
        userClaimableRewards: {
          status: 'loaded',
          error: null,
          data: claimableRewards
            ? denominated(decodeBigNumber(claimableRewards).toFixed(), {
                decimals: 4
              })
            : '0'
        }
      });
    } catch (error) {
      dispatch({
        type: 'getUserClaimableRewards',
        userClaimableRewards: {
          status: 'error',
          data: null,
          error
        }
      });
    }
  };

  const fetchClaimableRewards = () => {
    if (!userClaimableRewards.data) {
      getUserClaimableRewards();
    }
  };

  const reFetchClaimableRewards = () => {
    if (hasSuccessfulTransactions && successfulTransactionsArray.length > 0) {
      getUserClaimableRewards();
    }
  };

  useEffect(fetchClaimableRewards, [userClaimableRewards.data]);
  useEffect(reFetchClaimableRewards, [
    hasSuccessfulTransactions,
    successfulTransactionsArray.length
  ]);

  useEffect(() => {
    if (pending && !check) {
      setCheck(true);

      return () => {
        setCheck(false);
      };
    }
  }, [pending]);

  return {
    onDelegate,
    onUndelegate,
    onRedelegate,
    onClaimRewards,
    getStakingLimits
  };
};

export default useStakeData;
