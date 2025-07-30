import { useEffect, useState } from "react";
import { faPercent } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useGetAccountInfo } from "@multiversx/sdk-dapp/hooks/account/useGetAccountInfo";
import classNames from "classnames";
import { network, denomination } from "config";
import { useGlobalContext } from "context";
import { ClaimColsButton } from "./ClaimColsButton";
import { ClaimEgldButton } from "./ClaimEgldButton";
import { useColsAprContext } from "../../context/ColsAprContext";
import styles from "./styles.module.scss";
import useStakeData from "./hooks";
import { HelpIcon } from "components/HelpIcon";
import { MultiversX } from "assets/MultiversX";
import { Delegate } from "./components/Delegate";
import { StakeCols } from "./components/StakeCols";
import { Undelegate } from "./components/Undelegate";
import { DashboardNewDelegator } from "../../pages/Dashboard/NewDelegatorBenefit";
import { ColsAprTable } from "../ColsAprTable";

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

// --- Universal Simulation logic ---
function simulateAprAndRank({
  stakers,
  address,
  simulatedColsStaked,
  simulatedEgldStaked,
  colsPrice,
  egldPrice,
  baseApr,
  serviceFee,
  agencyLockedEgld
}: {
  stakers: any[];
  address: string;
  simulatedColsStaked: number;
  simulatedEgldStaked: number;
  colsPrice: number;
  egldPrice: number;
  baseApr: number;
  serviceFee: number;
  agencyLockedEgld: number;
}) {
  const APRmin = 0.01;
  const APRmax = 15;
  const AGENCY_BUYBACK = 0.3;
  const DAO_DISTRIBUTION_RATIO = 0.333;

  // If user is not in stakers, add them as a synthetic row for simulation
  let found = stakers.find((s: any) => s.address === address);
  let newStakers = [...stakers];
  if (!found) {
    newStakers.push({
      address,
      colsStaked: simulatedColsStaked,
      egldStaked: simulatedEgldStaked,
      ratio: null,
      normalized: null,
      aprBonus: null,
      dao: null,
      aprTotal: null,
      rank: null,
      aprColsOnly: null
    });
  } else {
    // If found, update their simulated values
    newStakers = newStakers.map((s: any) =>
      s.address === address
        ? { ...s, colsStaked: simulatedColsStaked, egldStaked: simulatedEgldStaked }
        : s
    );
  }

  // 1. Recalculate ratios
  for (const row of newStakers) {
    if (row.egldStaked > 0 && colsPrice > 0 && egldPrice > 0) {
      row.ratio = (row.colsStaked * colsPrice) / (row.egldStaked * egldPrice);
    } else {
      row.ratio = null;
    }
  }

  // 2. Normalize
  const validRatios = newStakers.filter((r: any) => r.ratio !== null).map((r: any) => r.ratio);
  const minRatio = validRatios.length > 0 ? Math.min(...validRatios) : 0;
  const maxRatio = validRatios.length > 0 ? Math.max(...validRatios) : 0;
  for (const row of newStakers) {
    if (row.ratio !== null && maxRatio !== minRatio) {
      row.normalized = (row.ratio - minRatio) / (maxRatio - minRatio);
    } else {
      row.normalized = null;
    }
  }

  // 3. APR Bonus
  for (const row of newStakers) {
    if (row.normalized !== null) {
      row.aprBonus = APRmin + (APRmax - APRmin) * Math.sqrt(row.normalized);
    } else {
      row.aprBonus = null;
    }
  }

  // 4. DAO
  const totalEgldStaked = agencyLockedEgld;
  const sumColsStaked = newStakers.reduce((sum: number, r: any) => sum + (r.colsStaked || 0), 0);
  for (const row of newStakers) {
    if (row.egldStaked > 0 && row.colsStaked > 0 && sumColsStaked > 0) {
      const baseAprCorrected = baseApr / (1 - serviceFee) / 100;
      const dao = (
        (
          (
            totalEgldStaked *
            baseAprCorrected *
            AGENCY_BUYBACK *
            serviceFee *
            DAO_DISTRIBUTION_RATIO *
            row.colsStaked
          ) / sumColsStaked
        ) / row.egldStaked
      ) * 100;
      row.dao = dao;
    } else {
      row.dao = null;
    }
  }

  // 5. COLS-only APR: Calculate for all users with COLS staked
  for (const row of newStakers) {
    if (row.colsStaked > 0) {
      // Use the same formula as in useColsApr.ts
      const baseAprCorrected = baseApr / (1 - serviceFee) / 100;
      const numerator =
        agencyLockedEgld *
        baseAprCorrected *
        AGENCY_BUYBACK *
        serviceFee *
        DAO_DISTRIBUTION_RATIO *
        egldPrice;
      const denominator = colsPrice * sumColsStaked;
      row.aprColsOnly = denominator === 0 ? 0 : (numerator / denominator) * 100;
    } else {
      row.aprColsOnly = null;
    }
  }

  // 6. APR_TOTAL: If user has eGLD, use normal formula. If user has no eGLD but has COLS, use aprColsOnly. Otherwise, just base APR.
  for (const row of newStakers) {
    if (row.egldStaked > 0) {
      row.aprTotal = baseApr + (row.aprBonus || 0) + (row.dao || 0);
    } else if (row.colsStaked > 0) {
      row.aprTotal = row.aprColsOnly !== null ? row.aprColsOnly : baseApr;
    } else {
      row.aprTotal = baseApr;
    }
  }

  // 7. Ranking
  const sorted = [...newStakers].sort((a: any, b: any) => (b.aprTotal || 0) - (a.aprTotal || 0));
  for (let i = 0; i < sorted.length; ++i) {
    sorted[i].rank = i + 1;
  }
  for (const row of newStakers) {
    const found = sorted.find((r: any) => r.address === row.address);
    row.rank = found ? found.rank : null;
  }

  // 8. Find the simulated user's new APR and rank
  const user = newStakers.find((s: any) => s.address === address);
  return {
    newApr: user && user.aprTotal !== undefined && user.aprTotal !== null ? user.aprTotal : null,
    newRank: user && user.rank !== undefined && user.rank !== null ? user.rank : null
  };
}

export const Stake = () => {
  const { address } = useGetAccountInfo();
  const { userActiveStake, stakedCols, contractDetails } = useGlobalContext();
  const { onRedelegate } = useStakeData();

  const hasEgldStaked = userActiveStake.data && userActiveStake.data !== "0";
  const hasColsStaked = stakedCols.data && stakedCols.data !== "0";

  const {
    loading: aprLoading,
    stakers,
    baseApr,
    egldPrice,
    colsPrice,
    agencyLockedEgld
  } = useColsAprContext();
  const [userApr, setUserApr] = useState<number | null>(null);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [isColsOnly, setIsColsOnly] = useState(false);

  useEffect(() => {
    if (!address || !Array.isArray(stakers) || stakers.length === 0) {
      setUserApr(null);
      setUserRank(null);
      setIsColsOnly(false);
      return;
    }
    const idx = stakers.findIndex((s: any) => s.address === address);
    if (idx === -1) {
      setUserApr(null);
      setUserRank(null);
      setIsColsOnly(false);
    } else {
      const user = stakers[idx];
      if (user.egldStaked === 0 && user.colsStaked > 0) {
        setUserApr(user.aprColsOnly ?? null);
        setIsColsOnly(true);
      } else {
        setUserApr(user.aprTotal ?? null);
        setIsColsOnly(false);
      }
      setUserRank(user.rank ?? null);
    }
  }, [address, stakers]);

  // --- Simulation State ---
  // Prefill logic: use actual staked values, or 1/1 if none, and round to integer
  let actualEgld = 0;
  let actualCols = 0;
  if (Array.isArray(stakers) && address) {
    const user = stakers.find((s: any) => s.address === address);
    if (user) {
      if (typeof user.egldStaked === 'number') actualEgld = user.egldStaked;
      if (typeof user.colsStaked === 'number') actualCols = user.colsStaked;
    }
  }
  const defaultEgld = actualEgld > 0 ? Math.round(actualEgld) : 1;
  const defaultCols = actualCols > 0 ? Math.round(actualCols) : 1;

  const [simulatedCols, setSimulatedCols] = useState<string>(defaultCols.toString());
  const [simulatedEgld, setSimulatedEgld] = useState<string>(defaultEgld.toString());
  const [simResult, setSimResult] = useState<{ newApr: number | null; newRank: number | null } | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  // Update prefill if user/account changes
  useEffect(() => {
    setSimulatedCols(defaultCols.toString());
    setSimulatedEgld(defaultEgld.toString());
    setSimError(null);
    setSimResult(null);
  }, [defaultCols, defaultEgld, address]);

  // Get serviceFee for simulation
  let serviceFee = 0.1;
  if (
    contractDetails &&
    contractDetails.data &&
    typeof contractDetails.data.serviceFee === 'string'
  ) {
    const feeStr = contractDetails.data.serviceFee.replace('%', '').trim();
    const feeNum = parseFloat(feeStr);
    if (!isNaN(feeNum)) {
      serviceFee = feeNum / 100;
    }
  }

  // Handle simulation apply
  const handleSimulate = async () => {
    setSimError(null);
    setSimResult(null);
    setSimLoading(true);
    if (!address) {
      setSimError("Not logged in");
      setSimLoading(false);
      return;
    }
    let valCols = 0;
    let valEgld = 0;
    try {
      valCols = parseFloat(simulatedCols);
      valEgld = parseFloat(simulatedEgld);
      if (isNaN(valCols) || valCols < 0) throw new Error();
      if (isNaN(valEgld) || valEgld < 0) throw new Error();
      if (valCols > 40000) {
        setSimError("Maximum COLS to simulate is 40,000");
        setSimLoading(false);
        return;
      }
      if (valEgld > 1000000) {
        setSimError("Maximum eGLD to simulate is 1,000,000");
        setSimLoading(false);
        return;
      }
      // Allow simulation even if both are zero, but show N/A as result
    } catch {
      setSimError("Invalid COLS or eGLD value");
      setSimLoading(false);
      return;
    }
    // Use already loaded stakers, prices, etc.
    const result = simulateAprAndRank({
      stakers,
      address,
      simulatedColsStaked: valCols,
      simulatedEgldStaked: valEgld,
      colsPrice,
      egldPrice,
      baseApr,
      serviceFee,
      agencyLockedEgld
    });
    setSimResult(result);
    setSimLoading(false);
  };

  return (
    <div
      className={classNames(
        styles.stake,
        { [styles.empty]: !hasEgldStaked && !hasColsStaked },
        "stake"
      )}
    >
      {/* Active Assets and APR section */}
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
          <div className={styles.actionsRow}>
            <div className={styles.actionButtonWrapper}><Delegate /></div>
            <div className={styles.actionButtonWrapper}><StakeCols /></div>
            <div className={styles.actionButtonWrapper}><Undelegate /></div>
          </div>
        </div>
        <div
          className={styles.assetsBox}
          style={{
            borderColor: "#6ee7c7",
            background: "linear-gradient(90deg, #6ee7c7 0%, #4f8cff 100%)",
            color: "#181a1b",
            minWidth: 220
          }}
        >
          <div className={styles.icon} style={{ background: "#fff" }}>
            <FontAwesomeIcon icon={faPercent} style={{ color: "#6ee7c7", fontSize: 32 }} />
          </div>
          <div className={styles.title} style={{ color: "#181a1b" }}>
            {isColsOnly ? "APR for your COLS" : "APR for your eGLD"}
            <HelpIcon text={
              isColsOnly
                ? "APR (Annual Percentage Rate) for COLS-only stakers. This is a theoretical yield based on the global COLS pool and agency rewards. You must have eGLD delegated to receive the full bonus APR."
                : "APR (Annual Percentage Rate) is your yearly yield. It is based on:\n- The base APR (set by the protocol)\n- Your COLS/eGLD ratio (the more COLS you stake relative to your eGLD, the higher your bonus)\n- DAO rewards (distributed to COLS stakers)\n\nAPR can increase if you stake more COLS relative to your eGLD."
            } />
          </div>
          <div className={styles.aprInfo}>
            <div>
              <b>Base APR:</b>
              <span className={styles.aprValue} style={{ color: "#181a1b", background: "none" }}>
                {aprLoading ? "..." : Number(baseApr).toFixed(2)}%
              </span>
              <HelpIcon text="Base APR is the standard annual percentage rate for all delegators, before any COLS bonus." />
            </div>
            <div>
              <b>Total APR{isColsOnly ? " (COLS-only)" : " with Bonus"}:</b>
              <span
                className={styles.aprValue}
                style={{
                  color: "#181a1b",
                  fontWeight: 700,
                  background: "none",
                  textShadow: "0 1px 8px #fff8"
                }}
              >
                <span style={{
                  color: "#181a1b",
                  background: "#ffe082",
                  padding: "2px 12px",
                  borderRadius: 6,
                  fontWeight: 900,
                  fontSize: 20,
                  letterSpacing: 0.5,
                  display: "inline-block",
                  boxShadow: "0 2px 8px #fff8"
                }}>
                  {aprLoading
                    ? "..."
                    : userApr !== null
                      ? Number(userApr).toFixed(2)
                      : Number(baseApr).toFixed(2)
                  }%
                </span>
              </span>
              <HelpIcon text={
                isColsOnly
                  ? "This is the global COLS-only APR. You must delegate eGLD to receive the full bonus APR."
                  : "Total APR includes your COLS bonus and DAO rewards. The more COLS you stake relative to your eGLD, the higher your bonus. DAO rewards are distributed to COLS stakers."
              } />
            </div>
            <div>
              <b>Your Ranking:</b>
              <span className={styles.aprValue} style={{ color: "#181a1b", background: "none" }}>
                <span style={{
                  color: "#fff",
                  background: "#1976d2",
                  padding: "2px 12px",
                  borderRadius: 6,
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: 0.5,
                  display: "inline-block",
                  boxShadow: "0 2px 8px #fff8"
                }}>
                  {aprLoading
                    ? "..."
                    : userRank !== null
                      ? `#${userRank} of ${stakers.length + (stakers.find((s: any) => s.address === address) ? 0 : 1)} COLS stakers`
                      : "N/A"}
                </span>
              </span>
              <HelpIcon text={
                "Ranking is based on your total APR compared to other stakers. The more COLS you stake (relative to your eGLD), the higher your rank."
              } />
            </div>
          </div>
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid #e0e0e0" }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Simulate COLS &amp; eGLD Staked</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="number"
                min={0}
                max={40000}
                step="any"
                value={simulatedCols}
                onChange={e => {
                  let val = e.target.value;
                  if (val === "") {
                    setSimulatedCols("");
                    setSimError(null);
                    return;
                  }
                  if (parseFloat(val) > 40000) {
                    setSimulatedCols("40000");
                    setSimError("Maximum COLS to simulate is 40,000");
                  } else {
                    setSimulatedCols(val);
                    setSimError(null);
                  }
                }}
                style={{
                  width: 100,
                  padding: 6,
                  borderRadius: 4,
                  border: "1px solid #bbb",
                  fontSize: 15
                }}
                placeholder="COLS"
              />
              <span style={{ fontWeight: 700, color: "#181a1b" }}>COLS</span>
              <input
                type="number"
                min={0}
                max={1000000}
                step="any"
                value={simulatedEgld}
                onChange={e => {
                  let val = e.target.value;
                  if (val === "") {
                    setSimulatedEgld("");
                    setSimError(null);
                    return;
                  }
                  if (parseFloat(val) > 1000000) {
                    setSimulatedEgld("1000000");
                    setSimError("Maximum eGLD to simulate is 1,000,000");
                  } else {
                    setSimulatedEgld(val);
                    setSimError(null);
                  }
                }}
                style={{
                  width: 100,
                  padding: 6,
                  borderRadius: 4,
                  border: "1px solid #bbb",
                  fontSize: 15
                }}
                placeholder={network.egldLabel}
              />
              <span style={{ fontWeight: 700, color: "#181a1b" }}>{network.egldLabel}</span>
              <button
                type="button"
                onClick={handleSimulate}
                style={{
                  background: "#6ee7c7",
                  color: "#181a1b",
                  border: "none",
                  borderRadius: 4,
                  padding: "6px 16px",
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #6ee7c7aa"
                }}
                disabled={simLoading}
              >
                {simLoading ? "Calculating..." : "Apply"}
              </button>
            </div>
            {simError && (
              <div style={{ color: "#b71c1c", marginTop: 6, fontSize: 14 }}>{simError}</div>
            )}
            {simResult && (
              <div style={{ marginTop: 10, fontSize: 15 }}>
                <div>
                  <b>Simulated Total APR:</b>{" "}
                  <span style={{
                    color: "#181a1b",
                    background: "#ffe082",
                    padding: "2px 12px",
                    borderRadius: 6,
                    fontWeight: 900,
                    fontSize: 20,
                    letterSpacing: 0.5,
                    display: "inline-block",
                    boxShadow: "0 2px 8px #fff8"
                  }}>
                    {simResult.newApr !== null ? simResult.newApr.toFixed(2) + "%" : "N/A"}
                  </span>
                </div>
                <div>
                  <b>Simulated Ranking:</b>{" "}
                  <span style={{
                    color: "#fff",
                    background: "#1976d2",
                    padding: "2px 12px",
                    borderRadius: 6,
                    fontWeight: 900,
                    fontSize: 18,
                    letterSpacing: 0.5,
                    display: "inline-block",
                    boxShadow: "0 2px 8px #fff8"
                  }}>
                    {simResult.newRank !== null ? `#${simResult.newRank} of ${stakers.length + (stakers.find((s: any) => s.address === address) ? 0 : 1)} COLS stakers` : "N/A"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Claim Rewards Section */}
      <div className={styles.panel}>
        <div className={styles.icon}>
          <MultiversX />
          <div style={{ background: "#6ee7c7" }} className={styles.subicon}>
            <FontAwesomeIcon icon={faPercent} />
          </div>
        </div>
        <div className={styles.title}>Claim Rewards</div>
        <div className={styles.actions}>
          <ClaimEgldButton onClaimed={() => {}} />
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
            className={classNames(styles.action)}
            onClick={onRedelegate(() => false)}
          >
            Redelegate eGLD
          </button>
          <ClaimColsButton onClaimed={() => {}} />
        </div>
      </div>
      {/* 10 days migration section */}
      <DashboardNewDelegator />
      {/* Table is always last, and only for the specific user */}
      {address === "erd1kr7m0ge40v6zj6yr8e2eupkeudfsnv827e7ta6w550e9rnhmdv6sfr8qdm" && (
        <ColsAprTable />
      )}
    </div>
  );
}
