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
import { RankingTable } from "./RankingTable";
import { AnimatedDots } from "components/AnimatedDots";

// League colors and icons for APR section
const LEAGUES = [
  { name: "Gold", color: "#FFD700", icon: "🥇" },
  { name: "Silver", color: "#C0C0C0", icon: "🥈" },
  { name: "Bronze", color: "#CD7F32", icon: "🥉" }
];

function getLeague(rank: number, total: number) {
  const perLeague = Math.ceil(total / 3);
  if (rank <= perLeague) return 0; // Gold
  if (rank <= perLeague * 2) return 1; // Silver
  return 2; // Bronze
}

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

// --- Universal Simulation logic (matches useColsApr.ts) ---
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
  // --- Constants (must match useColsApr.ts) ---
  const APRmin = 0.3;
  let APRmax = 15;
  const AGENCY_BUYBACK = 0.3;
  const DAO_DISTRIBUTION_RATIO = 0.333;
  const BONUS_BUYBACK_FACTOR = 0.66;

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

  // 1. Calculate targetAvgAprBonus (as in useColsApr.ts)
  const targetAvgAprBonus =
    (
      agencyLockedEgld *
      baseApr /
      (1 - serviceFee) /
      100 *
      serviceFee *
      AGENCY_BUYBACK *
      BONUS_BUYBACK_FACTOR *
      egldPrice / colsPrice
    ) / 365;

  // 2. Iteratively adjust APRmax to match the sum of COLS-DIST
  let step = 0.1;
  let bestAprMax = APRmax;
  let bestDiff = Infinity;
  let maxIter = 200;
  let iter = 0;
  let lastSum = 0;
  function calcAprBonusTableSum({
    stakers,
    egldPrice,
    colsPrice,
    aprMax,
    aprMin
  }: {
    stakers: any[];
    egldPrice: number;
    colsPrice: number;
    aprMax: number;
    aprMin: number;
  }) {
    const filtered = stakers.filter(
      (row: any) => row.colsStaked > 0 && row.egldStaked > 0
    );
    let minRatio = Infinity, maxRatio = -Infinity;
    for (const row of filtered) {
      row.ratio = (row.colsStaked * colsPrice) / (row.egldStaked * egldPrice);
      if (row.ratio < minRatio) minRatio = row.ratio;
      if (row.ratio > maxRatio) maxRatio = row.ratio;
    }
    for (const row of filtered) {
      row.normalized = (maxRatio !== minRatio && row.ratio !== null)
        ? (row.ratio - minRatio) / (maxRatio - minRatio)
        : 0;
      row.aprBonus = aprMin + (aprMax - aprMin) * Math.sqrt(row.normalized);
    }
    let sum = 0;
    for (const row of filtered) {
      if (row.aprBonus !== null) {
        const dist = (row.aprBonus / 100) * row.egldStaked * egldPrice / 365 / colsPrice;
        sum += dist;
      }
    }
    return sum;
  }
  while (iter < maxIter) {
    if (APRmax > 25) APRmax = 25;
    if (APRmax < APRmin) APRmax = APRmin;
    const sum = calcAprBonusTableSum({
      stakers: newStakers.map(r => ({ ...r })),
      egldPrice,
      colsPrice,
      aprMax: APRmax,
      aprMin: APRmin
    });
    const diff = Math.abs(sum - targetAvgAprBonus);
    if (diff < 1) {
      bestAprMax = APRmax;
      break;
    }
    if (diff < bestDiff) {
      bestDiff = diff;
      bestAprMax = APRmax;
    }
    if (sum < targetAvgAprBonus) {
      APRmax += step;
    } else {
      APRmax -= step;
    }
    if ((lastSum < targetAvgAprBonus && sum > targetAvgAprBonus) ||
        (lastSum > targetAvgAprBonus && sum < targetAvgAprBonus)) {
      step = Math.max(0.01, step / 2);
    }
    lastSum = sum;
    iter++;
  }

  // 3. Calculate ratios
  for (const row of newStakers) {
    if (row.egldStaked > 0 && colsPrice > 0 && egldPrice > 0) {
      row.ratio = (row.colsStaked * colsPrice) / (row.egldStaked * egldPrice);
    } else {
      row.ratio = null;
    }
  }
  // 4. Normalize
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
  // 5. APR Bonus
  for (const row of newStakers) {
    if (row.normalized !== null) {
      row.aprBonus = APRmin + (bestAprMax - APRmin) * Math.sqrt(row.normalized);
    } else {
      row.aprBonus = null;
    }
  }
  // 6. DAO
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
  // 7. COLS-only APR
  for (const row of newStakers) {
    if (row.colsStaked > 0) {
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
  // 8. APR_TOTAL
  for (const row of newStakers) {
    if (row.egldStaked > 0) {
      row.aprTotal = baseApr + (row.aprBonus || 0) + (row.dao || 0);
    } else if (row.colsStaked > 0) {
      row.aprTotal = row.aprColsOnly !== null ? row.aprColsOnly : baseApr;
    } else {
      row.aprTotal = baseApr;
    }
  }
  // 9. Ranking
  const sorted = [...newStakers].sort((a: any, b: any) => (b.aprTotal || 0) - (a.aprTotal || 0));
  for (let i = 0; i < sorted.length; ++i) {
    sorted[i].rank = i + 1;
  }
  for (const row of newStakers) {
    const found = sorted.find((r: any) => r.address === row.address);
    row.rank = found ? found.rank : null;
  }
  // 10. Find the simulated user's new APR and rank
  const user = newStakers.find((s: any) => s.address === address);
  return {
    newApr: user && user.aprTotal !== undefined && user.aprTotal !== null ? user.aprTotal : null,
    newRank: user && user.rank !== undefined && user.rank !== null ? user.rank : null
  };
}

// --- Fetch latest values for simulation ---
async function fetchLatestSimulationData(delegationContract: string) {
  // Fetch baseApr, agencyLockedEgld, egldPrice, colsPrice
  let baseApr = 0, agencyLockedEgld = 0, egldPrice = 0, colsPrice = 0;
  try {
    // baseApr and agencyLockedEgld
    const { data } = await fetch("https://api.multiversx.com/providers/" + delegationContract).then(res => res.json());
    if (data && typeof data.apr === "number") baseApr = data.apr;
    if (data && typeof data.locked === "string") {
      agencyLockedEgld = Number(data.locked) / 1e18;
      agencyLockedEgld = Math.round(agencyLockedEgld * 10000) / 10000;
    }
  } catch {}
  try {
    // egldPrice
    const { data } = await fetch("https://api.multiversx.com/economics").then(res => res.json());
    if (data && typeof data.price === "number") egldPrice = data.price;
  } catch {}
  try {
    // colsPrice
    const { data } = await fetch("https://api.multiversx.com/mex/tokens/prices/hourly/COLS-9d91b7").then(res => res.json());
    if (Array.isArray(data) && data.length > 0) {
      const last = data[data.length - 1];
      if (last && typeof last.value === "number") {
        colsPrice = Math.round(last.value * 1000) / 1000;
      }
    }
  } catch {}
  return { baseApr, agencyLockedEgld, egldPrice, colsPrice };
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

  useEffect(() => {
    setSimulatedCols(defaultCols.toString());
    setSimulatedEgld(defaultEgld.toString());
    setSimError(null);
    setSimResult(null);
  }, [defaultCols, defaultEgld, address]);

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

  // --- FIX: Always use latest values for simulation ---
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
    } catch {
      setSimError("Invalid COLS or eGLD value");
      setSimLoading(false);
      return;
    }

    // Wait for all real data to be loaded
    if (
      aprLoading ||
      !Array.isArray(stakers) ||
      stakers.length === 0 ||
      !contractDetails.data
    ) {
      setSimError("Please wait for all data to load before simulating.");
      setSimLoading(false);
      return;
    }

    // Fetch latest values for simulation
    let simBaseApr = baseApr;
    let simAgencyLockedEgld = agencyLockedEgld;
    let simEgldPrice = egldPrice;
    let simColsPrice = colsPrice;

    // Fetch latest from API to ensure simulation matches reality
    try {
      const latest = await fetchLatestSimulationData(network.delegationContract);
      if (latest.baseApr) simBaseApr = latest.baseApr;
      if (latest.agencyLockedEgld) simAgencyLockedEgld = latest.agencyLockedEgld;
      if (latest.egldPrice) simEgldPrice = latest.egldPrice;
      if (latest.colsPrice) simColsPrice = latest.colsPrice;
    } catch {}

    // Use already loaded stakers, but with latest values
    const result = simulateAprAndRank({
      stakers,
      address,
      simulatedColsStaked: valCols,
      simulatedEgldStaked: valEgld,
      colsPrice: simColsPrice,
      egldPrice: simEgldPrice,
      baseApr: simBaseApr,
      serviceFee,
      agencyLockedEgld: simAgencyLockedEgld
    });
    setSimResult(result);
    setSimLoading(false);
  };

  // Find user's league for APR section (after effect)
  let leagueIdx = 2;
  if (Array.isArray(stakers) && address) {
    const user = stakers.find((s: any) => s.address === address);
    if (user && user.rank) {
      leagueIdx = getLeague(user.rank, stakers.length);
    }
  }

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
            borderColor: "transparent",
            background: "linear-gradient(120deg, #fffbe6 0%, #ffe082 40%, #FFD700 100%)",
            color: "#181a1b",
            minWidth: 220,
            boxShadow: "0 0 32px 8px #FFD70055, 0 2px 24px #FFD70033"
          }}
        >
          <div className={styles.icon} style={{ background: "#fff" }}>
            <span style={{ fontSize: 32 }}>
              {LEAGUES[leagueIdx].icon}
            </span>
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
                {simLoading ? <><AnimatedDots /> Calculating...</> : "Apply"}
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
      {/* --- Gamified Ranking Table --- */}
      <RankingTable />
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
};
