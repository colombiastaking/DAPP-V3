import { useEffect } from 'react';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useNavigate } from 'react-router-dom';

import { Withdrawals } from 'components/Withdrawals';
import { PriceBanner } from 'components/PriceBanner';

import styles from './styles.module.scss';

export const Dashboard = () => {
  const account = useGetAccount();
  const address = account.address;
  const navigate = useNavigate();

  useEffect(() => {
    if (!address) {
      navigate('/unlock');
    }
  }, [address, navigate]);

  // Note: useGlobalData() is already called in Layout.tsx - don't call again here

  return (
    <div className={styles.dashboard}>
      <PriceBanner />
      <Withdrawals />
    </div>
  );
};
