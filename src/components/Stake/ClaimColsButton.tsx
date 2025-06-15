import { useEffect, useState } from "react";
import { useGetAccountInfo } from "@multiversx/sdk-dapp/hooks/account/useGetAccountInfo";
import { useGetActiveTransactionsStatus } from "@multiversx/sdk-dapp/hooks/transactions/useGetActiveTransactionsStatus";
import classNames from "classnames";
import { sendTransactions } from "@multiversx/sdk-dapp/services/transactions/sendTransactions";
import { network } from "config";
import { fetchClaimableCols } from "helpers/fetchClaimableCols";

const CLAIM_COLS_CONTRACT = "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0";
const ENTITY_ADDRESS = "erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0";
const CLAIM_COLS_DATA = "claimRewards@00000000000000000500f5ae3a400dae272bd254689fd5a44f88e3f2949e5787";
const CLAIM_COLS_GAS_LIMIT = 10_000_000;

// Format to 2 decimals, with commas
function denominateCols(raw: string) {
  if (!raw || raw === "0") return "0.00";
  let str = raw.padStart(19, "0");
  const intPart = str.slice(0, -18) || "0";
  let decPart = str.slice(-18).replace(/0+$/, "");
  let result = decPart ? `${intPart}.${decPart}` : intPart;
  // Format to 2 decimals
  let num = Number(result);
  let formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return formatted;
}

export function ClaimColsButton({ onClaimed }: { onClaimed: () => void }) {
  const { address } = useGetAccountInfo();
  const { pending } = useGetActiveTransactionsStatus();
  const [claimable, setClaimable] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        if (!address) {
          setClaimable(null);
          setLoading(false);
          return;
        }
        const amount = await fetchClaimableCols({
          contract: CLAIM_COLS_CONTRACT,
          entity: ENTITY_ADDRESS,
          user: address,
          providerUrl: network.gatewayAddress
        });
        if (mounted) setClaimable(amount);
      } catch (e: any) {
        if (mounted) setError("Failed to fetch claimable COLS");
      }
      setLoading(false);
    }
    fetchData();
    return () => { mounted = false; };
  }, [address]);

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

  // Button is enabled if user is logged in and not loading/txLoading/pending
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
      onClick={handleClaimCols}
      className={classNames("claim-cols-btn")}
      disabled={isDisabled}
    >
      <span role="img" aria-label="fire">🔥</span>
      Claim COLS
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
          {claimable !== null ? denominateCols(claimable) : "—"}
        </span>
      )}
      <span role="img" aria-label="fire">🔥</span>
      {txLoading && (
        <span style={{ marginLeft: 8, fontSize: 14 }}>...</span>
      )}
      {error && (
        <span style={{ color: "#b71c1c", marginLeft: 8, fontSize: 13 }}>{error}</span>
      )}
    </button>
  );
}
