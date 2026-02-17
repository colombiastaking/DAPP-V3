import { useEffect, useState } from "react";
import { useGetAccount } from "@multiversx/sdk-dapp/out/react/account/useGetAccount";
import { useGetActiveTransactionsStatus } from "hooks/useTransactionStatus";
import classNames from "classnames";
import { sendTransactions } from 'helpers/sendTransactions';
import { network } from "config";
import { useGlobalContext } from "context";
import { AnimatedDots } from "components/AnimatedDots";

import styles from './ClaimEgldButton.module.scss';

export function ClaimEgldButton({ onClaimed }: { onClaimed: () => void }) {
  const account = useGetAccount();
  const address = account.address;
  const { pending } = useGetActiveTransactionsStatus();
  const { userClaimableRewards } = useGlobalContext();
  const [claimable, setClaimable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (!address) {
      setClaimable(null);
      setLoading(false);
      return;
    }
    if (userClaimableRewards.status === "loaded") {
      setClaimable(userClaimableRewards.data || "0");
      setLoading(false);
    } else if (userClaimableRewards.status === "error") {
      setError("Failed to fetch claimable eGLD");
      setLoading(false);
    }
  }, [address, userClaimableRewards.status, userClaimableRewards.data]);

  const handleClaimEgld = async () => {
    setError(null);
    setTxLoading(true);
    try {
      await sendTransactions({
        transactions: [
          {
            value: "0",
            data: "claimRewards",
            receiver: network.delegationContract,
            gasLimit: 6_000_000
          }
        ]
      });
      setTxLoading(false);
      onClaimed();
    } catch (e: any) {
      setError(e?.message || "Failed to send transaction");
      setTxLoading(false);
    }
  };

  const isDisabled = pending || txLoading || loading || !address;
  const hasRewards = claimable !== null && Number(claimable) > 0;

  return (
    <button
      type="button"
      className={classNames(
        styles.button,
        hasRewards ? styles.buttonAccent : styles.buttonSecondary
      )}
      onClick={handleClaimEgld}
      disabled={isDisabled}
    >
      <span className={styles.icon}>🎁</span>
      <span className={styles.label}>Claim</span>
      {loading ? (
        <span className={styles.badge}><AnimatedDots /></span>
      ) : (
        <span className={styles.badge}>
          {claimable !== null ? `${Number(claimable).toFixed(4)} eGLD` : "—"}
        </span>
      )}
      {txLoading && <span className={styles.loading}><AnimatedDots /></span>}
      {error && <span className={styles.error}>{error}</span>}
    </button>
  );
}