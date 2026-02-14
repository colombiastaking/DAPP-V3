import { useEffect, useCallback, useRef } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useGetSuccessfulTransactions } from '@multiversx/sdk-dapp/hooks/transactions/useGetSuccessfulTransactions';
import { Address, AddressValue, Query, ContractFunction, decodeBigNumber } from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { useDispatch } from 'context';
import { network } from 'config';
import { fetchClaimableColsAndLockTime } from 'helpers/fetchClaimableCols';
import { denominated } from 'helpers/denominate';

const CLAIM_COLS_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const ENTITY_ADDRESS = 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0';
const DELEGATION_CONTRACT = 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf';

/**
 * Hook to preload and cache all shared data at login:
 * - Delegator count
 * - Claimable COLS and lock time
 * - eGLD claimable rewards
 */
export function usePreloadData() {
  const { address } = useGetAccountInfo();
  const { hasSuccessfulTransactions } = useGetSuccessfulTransactions();
  const dispatch = useDispatch();
  const hasLoadedRef = useRef(false);

  // Fetch delegator count
  const fetchDelegatorCount = useCallback(async () => {
    dispatch({
      type: 'getDelegatorCount',
      delegatorCount: { status: 'loading', data: null, error: null }
    });

    try {
      const res = await fetch(
        `https://staking.colombia-staking.com/mvx-api/providers/${DELEGATION_CONTRACT}`
      );
      const data = await res.json();
      const count = data?.numUsers || data?.accounts || 0;
      dispatch({
        type: 'getDelegatorCount',
        delegatorCount: { status: 'loaded', data: count, error: null }
      });
    } catch (error) {
      dispatch({
        type: 'getDelegatorCount',
        delegatorCount: { status: 'error', data: null, error }
      });
    }
  }, [dispatch]);

  // Fetch claimable COLS and lock time
  const fetchClaimableCols = useCallback(async () => {
    if (!address) return;

    dispatch({
      type: 'getClaimableCols',
      claimableCols: { status: 'loading', data: null, error: null }
    });
    dispatch({
      type: 'getColsLockTime',
      colsLockTime: { status: 'loading', data: null, error: null }
    });

    try {
      const { claimable, lockTime } = await fetchClaimableColsAndLockTime({
        contract: CLAIM_COLS_CONTRACT,
        entity: ENTITY_ADDRESS,
        user: address,
        providerUrl: network.gatewayAddress
      });

      dispatch({
        type: 'getClaimableCols',
        claimableCols: { status: 'loaded', data: claimable, error: null }
      });
      dispatch({
        type: 'getColsLockTime',
        colsLockTime: { status: 'loaded', data: lockTime, error: null }
      });
    } catch (error) {
      dispatch({
        type: 'getClaimableCols',
        claimableCols: { status: 'error', data: null, error }
      });
      dispatch({
        type: 'getColsLockTime',
        colsLockTime: { status: 'error', data: null, error }
      });
    }
  }, [address, dispatch]);

  // Fetch eGLD claimable rewards
  const fetchClaimableEgld = useCallback(async () => {
    if (!address) return;

    dispatch({
      type: 'getUserClaimableRewards',
      userClaimableRewards: { status: 'loading', data: null, error: null }
    });

    try {
      const provider = new ProxyNetworkProvider(network.gatewayAddress);
      const query = new Query({
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
            ? denominated(decodeBigNumber(claimableRewards).toFixed(), { decimals: 4 })
            : '0'
        }
      });
    } catch (error) {
      dispatch({
        type: 'getUserClaimableRewards',
        userClaimableRewards: { status: 'error', data: null, error }
      });
    }
  }, [address, dispatch]);

  // Preload all data once when user logs in
  useEffect(() => {
    if (!address || hasLoadedRef.current) return;
    
    hasLoadedRef.current = true;
    fetchDelegatorCount();
    fetchClaimableCols();
    fetchClaimableEgld();
  }, [address, fetchDelegatorCount, fetchClaimableCols, fetchClaimableEgld]);

  // Refresh claimable data after transactions complete
  useEffect(() => {
    if (hasSuccessfulTransactions) {
      fetchClaimableCols();
      fetchClaimableEgld();
    }
  }, [hasSuccessfulTransactions, fetchClaimableCols, fetchClaimableEgld]);

  return {
    fetchDelegatorCount,
    fetchClaimableCols,
    fetchClaimableEgld,
    isLoading: !hasLoadedRef.current
  };
}