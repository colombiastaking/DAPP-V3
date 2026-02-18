import { useEffect, useState } from 'react';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useGetAccount } from '@multiversx/sdk-dapp/out/react/account/useGetAccount';
import { useNavigate } from 'react-router-dom';

import { Cards } from 'components/Cards';
import { Heading } from 'components/Heading';
import { Nodes } from 'components/Nodes';
import { Toggles } from 'components/Toggles';

import { useGlobalContext } from 'context';

import styles from './styles.module.scss';

export const Admin = () => {
  const account = useGetAccount();
  const address = account.address;
  const { contractDetails } = useGlobalContext();
  const [loading, setLoading] = useState<boolean>(true);

  const navigate = useNavigate();
  const handleRedirect = () => {
    if (!address) {
      navigate('/unlock');
      return;
    }

    if (contractDetails.status === 'loaded') {
      if (contractDetails.data && contractDetails.data.owner) {
        setLoading(false);
      } else {
        navigate('/dashboard');
      }
    }
  };

  useEffect(handleRedirect, [address, contractDetails.data]);
  // Note: useGlobalData() is already called in Layout.tsx - don't call again here

  if (loading) {
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
        Loading...
      </div>
    );
  }

  return (
    <div className={styles.admin}>
      <Heading />
      <Cards />
      <Toggles />
      <Nodes />
    </div>
  );
};
