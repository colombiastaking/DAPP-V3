import { useGetAccountInfo } from '@multiversx/sdk-dapp/hooks/account/useGetAccountInfo';
import { ClaimColsButton } from 'components/Stake/ClaimColsButton';
import { StakeCols } from 'components/Stake/components/StakeCols';
import { BuyCols } from 'components/Stake/components/BuyCols';
import styles from './styles.module.scss';

export const Stake = () => {
  const { address } = useGetAccountInfo();

  if (!address) {
    return <div>Please connect your wallet to view your stake.</div>;
  }

  return (
    <div className={styles.stake}>
      <div className={styles.buttonsRow}>
        <StakeCols />
        <ClaimColsButton onClaimed={() => {}} />
      </div>
      <BuyCols />
    </div>
  );
};

export default Stake;
