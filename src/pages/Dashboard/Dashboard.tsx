import { useEffect, useState } from 'react';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useNavigate } from 'react-router-dom';

import { Stake } from 'components/Stake';
import { Withdrawals } from 'components/Withdrawals';
import { ColsAprTable } from 'components/ColsAprTable';
import { PriceBanner } from 'components/PriceBanner';

import styles from './styles.module.scss';
import useGlobalData from '../../hooks/useGlobalData';
import { useColsAprContext } from '../../context/ColsAprContext';

export const Dashboard = () => {
  const { address } = useGetAccountInfo();
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const handleRedirect = () =>
    address ? setLoading(false) : navigate('/unlock');

  useEffect(handleRedirect, [address]);
  useGlobalData();

  // --- Add: ColsApr loading state for prices, APR, ranking ---
  const { loading: colsAprLoading } = useColsAprContext();

  if (loading || colsAprLoading) {
    return (
      <div
        style={{ fontSize: '30px' }}
        className='d-flex align-items-center justify-content-center text-white flex-fill'
      >
        <FontAwesomeIcon
          icon={faSpinner}
          size='2x'
          spin={true}
          className='mr-3'
        />
        Loading staking data, prices, APR, and ranking...
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <PriceBanner />
      <Stake />
      <Withdrawals />
      <ColsAprTable />
    </div>
  );
};
