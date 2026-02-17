import { useEffect, useState } from "react";
import { useGetAccount } from "@multiversx/sdk-dapp/out/react/account/useGetAccount";
import { useGetActiveTransactionsStatus } from "hooks/useTransactionStatus";
import classNames from "classnames";
import { sendTransactions } from 'helpers/sendTransactions';
import { network } from "config";
import { useGlobalContext, useDispatch } from "context";
import { fetchClaimableColsAndLockTime } from "helpers/fetchClaimableCols";
import { AnimatedDots } from "components/AnimatedDots";

import styles from './ClaimColsButton.module.scss';

const CLAIM_COLS_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";
const ENTITY_ADDRESS = "erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0";
const CLAIM_COLS_DATA = "claimRewards@00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787";
const CLAIM_COLS_GAS_LIMIT = 10_000_000;

function denominateCols(raw: string) {
  if (!raw || raw === "0") return "0.0000";
  let str = raw.padStart(19, "0");
  const intPart = str.slice(0, -18) || "0";
  let decPart = str.slice(-18).replace(/0+$/, "");
  let result = decPart ? `${intPart}.${decPart}` : intPart;
  let num = Number(result);
  return num.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function ClaimColsButton({ onClaimed }: { onClaimed: () => void }) {
  const account = useGetAccount();
  const address = account.address;
  const { pending, success } = useGetActiveTransactionsStatus();
  const { claimableCols } = useGlobalContext();
  const dispatch = useDispatch();
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimable = claimableCols.status === 'loaded' ? claimableCols.data : null;
  const loading = claimableCols.status === 'loading';
  const hasRewards = claimable !== null && Number(claimable) > 0;

  useEffect(() => {
    let mounted = true;
    async function refreshClaimable() {
      if (!address || !success) return;
      try {
        const { claimable: newClaimable } = await fetchClaimableColsAndLockTime({
          contract: CLAIM_COLS_CONTRACT,
          entity: ENTITY_ADDRESS,
          user: address,
          providerUrl: network.gatewayAddress
        });
        if (mounted) {
          dispatch({
            type: 'getClaimableCols',
            claimableCols: { status: 'loaded', data: newClaimable, error: null }
          });
          onClaimed();
        }
      } catch (e) {
        console.error('Failed to refresh claimable COLS', e);
      }
    }
    refreshClaimable();
    return () => { mounted = false; };
  }, [success, address, dispatch, onClaimed]);

  const handleClaimCols = async () => {
    setError(null);
    setTxLoading(true);
    try {
      await sendTransactions({
        transactions: [
          {
            value: "0",
            data: CLAIM_COLS_DATA,
            receiver: CLAIM_COLS_CONTRACT,
            gasLimit: CLAIM_COLS_GAS_LIMIT
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

  return (
    <button
      type="button"
      className={classNames(
        styles.button,
        hasRewards ? styles.buttonAccent : styles.buttonSecondary
      )}
      onClick={handleClaimCols}
      disabled={isDisabled}
    >
      <span className={styles.icon}>🎁</span>
      <span className={styles.label}>Claim COLS</span>
      {loading ? (
        <span className={styles.badge}><AnimatedDots /></span>
      ) : (
        <span className={styles.badge}>
          {claimable !== null ? denominateCols(claimable) : "—"}
        </span>
      )}
      {txLoading && <span className={styles.loading}><AnimatedDots /></span>}
      {error && <span className={styles.error}>{error}</span>}
    </button>
  );
}