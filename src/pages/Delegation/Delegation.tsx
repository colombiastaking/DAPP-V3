import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { Delegate } from 'components/Stake/components/Delegate';
import { Undelegate } from 'components/Stake/components/Undelegate';
import { ClaimEgldButton } from 'components/Stake/ClaimEgldButton';
import { Withdrawals } from 'components/Withdrawals';
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
          className={styles.redelegateButton}
          onClick={onRedelegate(() => {})}
        >
          Redelegate eGLD
        </button>
        <Undelegate />
      </div>
      <div style={{ marginTop: 24 }}>
        <Withdrawals />
      </div>
    </div>
  );
};

export default Delegation;
