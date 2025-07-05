import { useEffect, useState } from "react";
import { useGetAccountInfo } from "@multiversx/sdk-dapp/hooks/account/useGetAccountInfo";
import { useGetActiveTransactionsStatus } from "@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus";
import classNames from "classnames";
import { sendTransactions } from "@multiversx/sdk-dapp/services/transactions/sendTransactions";
import { network } from "config";
import { useGlobalContext } from "context";

// No need for denominateEgld, value is already formatted in context

export function ClaimEgldButton({ onClaimed }: { onClaimed: () => void }) {
  const { address } = useGetAccountInfo();
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

  return (
    <button
      type="button"
      style={{
        background: "#6ee7c7",
        color: "#181a1b",
        fontWeight: 700,
        borderRadius: 7,
        padding: "15px 30px",
        border: "none",
        marginRight: 0,
        marginBottom: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 16,
        boxShadow: "0 2px 8px #6ee7c7aa"
      }}
      onClick={handleClaimEgld}
      className={classNames("claim-egld-btn")}
      disabled={isDisabled}
    >
      <span role="img" aria-label="gift">🎁</span>
      Claim eGLD
      {loading ? (
        <span style={{ marginLeft: 8, fontSize: 14 }}>...</span>
      ) : (
        <span style={{
          marginLeft: 8,
          fontWeight: 900,
          color: "#1976d2",
          background: "#fff",
          borderRadius: 6,
          padding: "2px 10px",
          fontSize: 15
        }}>
          {claimable !== null ? claimable : "—"}
        </span>
      )}
      <span role="img" aria-label="gift">🎁</span>
      {txLoading && (
        <span style={{ marginLeft: 8, fontSize: 14 }}>...</span>
      )}
      {error && (
        <span style={{ color: "#b71c1c", marginLeft: 8, fontSize: 13 }}>{error}</span>
      )}
    </button>
  );
}
