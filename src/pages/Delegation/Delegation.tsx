import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { Delegate } from 'components/Stake/components/Delegate';
import { Undelegate } from 'components/Stake/components/Undelegate';
import { ClaimEgldButton } from 'components/Stake/ClaimEgldButton';
import useStakeData from 'components/Stake/hooks';
import styles from './Delegation.module.scss';

export const Delegation = () => {
  const { address } = useGetAccountInfo();
  const { onRedelegate } = useStakeData();

  if (!address) {
    return (
      <div className={styles.noAddress}>
        Please connect your wallet to access delegation features.
      </div>
    );
  }

  return (
    <div className={styles.delegation}>
      <div className={styles.buttonWrapper}>
        <Delegate />
        <ClaimEgldButton onClaimed={() => {}} />
        <button
          type="button"
          className={`${styles.redelegateButton}`}
          onClick={onRedelegate(() => {})}
          style={{
            background: '#6ee7c7',
            color: '#181a1b',
            fontWeight: 700,
            borderRadius: 8,
            padding: '15px 30px',
            boxShadow: '0 2px 8px #6ee7c7aa',
            cursor: 'pointer',
            fontSize: 16,
            marginLeft: 12
          }}
        >
          Redelegate eGLD
        </button>
        <Undelegate />
      </div>
    </div>
  );
};

export default Delegation;
