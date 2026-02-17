import { useEffect, useState } from "react";
import { useGetAccount } from "@multiversx/sdk-dapp/out/react/account/useGetAccount";
import classNames from "classnames";
import { network, denomination } from "config";
import { useGlobalContext } from "context";
import { ClaimColsButton } from "./ClaimColsButton";
import { ClaimEgldButton } from "./ClaimEgldButton";
import styles from "./styles.module.scss";
import useStakeData from "./hooks";
import { MultiversX } from "assets/MultiversX";
import { Delegate } from "./components/Delegate";
import { StakeCols } from "./components/StakeCols";
import { Undelegate } from "./components/Undelegate";
import { DashboardNewDelegator } from "../../pages/Dashboard/NewDelegatorBenefit";
import { ColsAprTable } from "../ColsAprTable";
import { RankingTable } from "./RankingTable";

import { fetchClaimableColsAndLockTime } from "helpers/fetchClaimableCols";

function formatEgld(amount: string | number) {
  const num = Number(amount);
  if (isNaN(num)) return amount;
  const egld = num / Math.pow(10, denomination);
  return egld.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
function formatCols(raw: string | number) {
  const num = Number(raw);
  if (isNaN(num)) return raw;
  const cols = num / 1e18;
  return cols.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function formatLockTime(lockTimestamp: number) {
  if (lockTimestamp === 0) return "No lock";
  const now = Math.floor(Date.now() / 1000);
  const diff = lockTimestamp - now;
  if (diff <= 0) return "Unlocked";
  const days = Math.floor(diff / (3600 * 24));
  const hours = Math.floor((diff % (3600 * 24)) / 3600);
  return `${days}d ${hours}h`;
}

export const Stake = () => {
  const account = useGetAccount();
  const address = account.address;
  const { userActiveStake, stakedCols } = useGlobalContext();
  const { onRedelegate } = useStakeData();

  const hasEgldStaked = userActiveStake.data && userActiveStake.data !== "0";
  const hasColsStaked = stakedCols.data && stakedCols.data !== "0";

  // New state for lock time info
  const [lockTimeRaw, setLockTimeRaw] = useState<number | null>(null);
  const [lockTimeFormatted, setLockTimeFormatted] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function fetchLockTime() {
      if (!address) {
        setLockTimeRaw(null);
        setLockTimeFormatted("");
        return;
      }
      try {
        const { lockTime } = await fetchClaimableColsAndLockTime({
          contract: "erd1qqqqqqqqqqqqqpgqjhn0rrta3hceyguqlmkqgklxc0eh0r5rl3tsv6a9k0",
          entity: "erd1qqqqqqqqqqqqqpgq7khr5sqd4cnjh5j5dz0atfz03r3l99y727rsulfjj0",
          user: address,
          providerUrl: network.gatewayAddress
        });
        if (mounted) {
          setLockTimeRaw(lockTime);
          setLockTimeFormatted(formatLockTime(lockTime));
        }
      } catch {
        if (mounted) {
          setLockTimeRaw(null);
          setLockTimeFormatted("");
        }
      }
    }
    fetchLockTime();
    return () => { mounted = false; };
  }, [address]);

  return (
    <div
      className={classNames(
        styles.stake,
        { [styles.empty]: !hasEgldStaked && !hasColsStaked },
        "stake"
      )}
    >
      {/* Active Assets and Lock Time display */}
      <div className={styles.assetsRow}>
        <div className={styles.assetsBox}>
          <div className={styles.icon}>
            <MultiversX />
            <div style={{ background: "#6ee7c7" }} className={styles.subicon}>
              <span role="img" aria-label="fire" style={{ color: "#ff9800", fontSize: 20 }}>🔥</span>
            </div>
          </div>
          <div className={styles.title}>Active Assets</div>
          <div className={styles.activeAmountsRow}>
            <span className={styles.activeAmount}>
              <b>
                {userActiveStake.status === "loaded"
                  ? formatEgld(userActiveStake.data || "...")
                  : "..."} {network.egldLabel}
              </b>
              <div className={styles.activeLabel}>delegated</div>
            </span>
            <span className={styles.activeAmount}>
              <b>
                {stakedCols.status === "loaded"
                  ? formatCols(stakedCols.data || "0")
                  : "..."} COLS
              </b>
              <div className={styles.activeLabel}>staked</div>
            </span>
          </div>
          <div style={{ marginTop: 12, color: "#6ee7c7", fontSize: 14, textAlign: "center" }}>
            <div><b>Lock Time (raw):</b> {lockTimeRaw !== null ? lockTimeRaw : "N/A"}</div>
            <div><b>Lock Time (remaining):</b> {lockTimeFormatted || "N/A"}</div>
          </div>
          <div className={styles.actionsRow}>
            <div className={styles.actionButtonWrapper}><Delegate /></div>
            <div className={styles.actionButtonWrapper}><StakeCols /></div>
            <div className={styles.actionButtonWrapper}><Undelegate /></div>
          </div>
        </div>
      </div>
      {/* Other UI parts unchanged */}
      <ClaimEgldButton onClaimed={() => {}} />
      <ClaimColsButton onClaimed={() => {}} />
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
          fontSize: 16,
          boxShadow: "0 2px 8px #6ee7c7aa"
        }}
        onClick={onRedelegate(() => false)}
      >
        Redelegate eGLD
      </button>
      <RankingTable />
      <DashboardNewDelegator />
      {address === "erd1kr7m0ge40v6zj6yr8mqdv6sfr8qdm" && (
        <ColsAprTable />
      )}
    </div>
  );
};
