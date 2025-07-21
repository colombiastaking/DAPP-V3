import { useEffect } from 'react';
import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { useNavigate } from 'react-router-dom';

import { Stake } from 'components/Stake';
import { Withdrawals } from 'components/Withdrawals';
import { PriceBanner } from 'components/PriceBanner';

import styles from './styles.module.scss';
import useGlobalData from '../../hooks/useGlobalData';

export const Dashboard = () => {
  const { address } = useGetAccountInfo();
  const navigate = useNavigate();

  useEffect(() => {
    if (!address) {
      navigate('/unlock');
    }
  }, [address, navigate]);

  useGlobalData();

  return (
    <div className={styles.dashboard}>
      <PriceBanner />
      <Stake />
      <Withdrawals />
    </div>
  );
};
