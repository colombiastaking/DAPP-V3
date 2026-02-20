import { useEffect, useCallback, useRef } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { Address, AddressValue, ContractFunction, decodeBigNumber } from '@multiversx/sdk-core';
import { ProxyNetworkProvider } from '@multiversx/sdk-network-providers';
import { useDispatch } from 'context';
import { network } from 'config';
import { fetchClaimableColsAndLockTime } from 'helpers/fetchClaimableCols';
import { denominated } from 'helpers/denominate';
import { useGetActiveTransactionsStatus } from './useTransactionStatus';
import { createContractQuery } from 'helpers/contractQuery';
import axios from 'axios';

const CLAIM_COLS_CONTRACT = 'erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0';
const ENTITY_ADDRESS = 'erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0';
const DELEGATION_CONTRACT = 'erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls5rqmaf';
const COLS_TOKEN_ID = 'COLS-9d91b7';

/**
 * Hook to preload and cache all shared data at login:
 * - Delegator count
 * - Claimable COLS and lock time
 * - eGLD claimable rewards
 * - COLS wallet balance
 * - User active stake (delegated eGLD)
 */
export function usePreloadData() {
  const account = useGetAccount();
  const address = account.address;
  const { hasSuccessfulTransactions } = useGetActiveTransactionsStatus();
  const dispatch = useDispatch();
  const hasLoadedRef = useRef(false);
  const lastAddressRef = useRef<string | null>(null);

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

  // Fetch COLS wallet balance
  const fetchColsBalance = useCallback(async () => {
    if (!address) return;

    dispatch({
      type: 'getColsBalance',
      colsBalance: { status: 'loading', data: null, error: null }
    });

    // Use public API - Colombia API doesn't index COLS tokens
    const PUBLIC_API = 'https://api.multiversx.com';

    try {
      const { data } = await axios.get(
        `${PUBLIC_API}/accounts/${address}/tokens?identifier=${COLS_TOKEN_ID}`
      );
      let balance = '0';
      if (Array.isArray(data) && data.length > 0 && data[0].identifier === COLS_TOKEN_ID) {
        // Denominate from 18 decimals
        const raw = data[0].balance;
        if (raw && raw !== '0') {
          const rawStr = raw.toString().padStart(19, '0');
          const intPart = rawStr.slice(0, -18) || '0';
          let decPart = rawStr.slice(-18).replace(/0+$/, '');
          balance = decPart ? `${intPart}.${decPart}` : intPart;
        }
      }
      dispatch({
        type: 'getColsBalance',
        colsBalance: { status: 'loaded', data: balance, error: null }
      });
    } catch (error) {
      dispatch({
        type: 'getColsBalance',
        colsBalance: { status: 'error', data: '0', error }
      });
    }
  }, [address, dispatch]);

  // Fetch user active stake (delegated eGLD)
  const fetchUserActiveStake = useCallback(async () => {
    if (!address) return;

    dispatch({
      type: 'getUserActiveStake',
      userActiveStake: { status: 'loading', data: null, error: null }
    });

    try {
      const provider = new ProxyNetworkProvider(network.gatewayAddress);
      const query = createContractQuery({
        address: new Address(DELEGATION_CONTRACT),
        func: new ContractFunction('getUserActiveStake'),
        args: [new AddressValue(new Address(address))]
      });

      const data = await provider.queryContract(query);
      const [userStake] = data.getReturnDataParts();

      dispatch({
        type: 'getUserActiveStake',
        userActiveStake: {
          status: 'loaded',
          error: null,
          data: userStake ? decodeBigNumber(userStake).toFixed() : '0'
        }
      });
    } catch (error) {
      dispatch({
        type: 'getUserActiveStake',
        userActiveStake: { status: 'error', data: null, error }
      });
    }
  }, [address, dispatch]);

  // Preload all data once when user logs in (and only re-fetch if address changes)
  useEffect(() => {
    // Skip if no address, already loaded, or same address (tab switch)
    if (!address || hasLoadedRef.current || lastAddressRef.current === address) return;
    
    lastAddressRef.current = address;
    hasLoadedRef.current = true;
    fetchDelegatorCount();
    fetchClaimableCols();
    fetchClaimableEgld();
    fetchColsBalance();
    fetchUserActiveStake();
  }, [address, fetchDelegatorCount, fetchClaimableCols, fetchClaimableEgld, fetchColsBalance, fetchUserActiveStake]);

  // Refresh data after transactions complete
  useEffect(() => {
    if (hasSuccessfulTransactions) {
      fetchClaimableCols();
      fetchClaimableEgld();
      fetchColsBalance();
      fetchUserActiveStake();
    }
  }, [hasSuccessfulTransactions, fetchClaimableCols, fetchClaimableEgld, fetchColsBalance, fetchUserActiveStake]);

  return {
    fetchDelegatorCount,
    fetchClaimableCols,
    fetchClaimableEgld,
    fetchColsBalance,
    fetchUserActiveStake,
    isLoading: hasLoadedRef.current === false
  };
}