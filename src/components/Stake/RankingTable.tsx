import { useColsAprContext } from "../../context/ColsAprContext";
import { useGetAccountInfo } from "@multiversx/sdk-dapp/hooks/account/useGetAccountInfo";
import { useEffect, useState } from "react";

// Types
type StakerRow = {
  address: string;
  aprTotal: number | null | undefined;
  rank?: number;
};

type ToNextType = {
  rank: number;
  apr: number | null | undefined;
  address: string;
  leagueName: string;
  icon: string;
} | null;

// Animal leagues with rank % ranges
const ANIMAL_LEAGUES = [
  { name: "Leviathan", icon: "🐉", color: "#9c27b0", range: [0, 1] },   // top 1%
  { name: "Whale", icon: "🐋", color: "#2196f3", range: [1, 5] },       // 1–5%
  { name: "Shark", icon: "🦈", color: "#03a9f4", range: [5, 15] },      // 5–15%
  { name: "Dolphin", icon: "🐬", color: "#00bcd4", range: [15, 30] },   // 15–30%
  { name: "Pufferfish", icon: "🐡", color: "#4caf50", range: [30, 50] },// 30–50%
  { name: "Fish", icon: "🐟", color: "#8bc34a", range: [50, 70] },      // 50–70%
  { name: "Crab", icon: "🦀", color: "#ff9800", range: [70, 90] },      // 70–90%
  { name: "Shrimp", icon: "🦐", color: "#f44336", range: [90, 100] },   // bottom 10%
];

// Get league by percentile
function getLeague(rank: number, total: number) {
  const percentile = (rank / total) * 100;
  return (
    ANIMAL_LEAGUES.find(
      (l) => percentile > l.range[0] && percentile <= l.range[1]
    ) || ANIMAL_LEAGUES[ANIMAL_LEAGUES.length - 1]
  );
}

export function RankingTable() {
  const { stakers, loading } = useColsAprContext();
  const { address } = useGetAccountInfo();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 700);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading || !Array.isArray(stakers) || stakers.length === 0) return null;

  // Sort stakers by APR
  const sorted: StakerRow[] = [...stakers].sort(
    (a, b) => (b.aprTotal ?? 0) - (a.aprTotal ?? 0)
  );
  const total = sorted.length;
  sorted.forEach((s, i) => (s.rank = i + 1));

  const top5 = sorted.slice(0, 5);

  // User row
  const userIdx = sorted.findIndex((s) => s.address === address);
  const user = userIdx !== -1 ? sorted[userIdx] : null;

  let userRows: StakerRow[] = [];
  if (user) {
    const start = Math.max(0, userIdx - 5);
    const end = Math.min(total, userIdx + 6);
    userRows = sorted.slice(start, end);
  }

  // Find next league target
  let toNext: ToNextType = null;
  if (user) {
    const currentLeague = getLeague(user.rank!, total);
    const currentIdx = ANIMAL_LEAGUES.findIndex(
      (l) => l.name === currentLeague.name
    );
    if (currentIdx > 0) {
      const nextLeague = ANIMAL_LEAGUES[currentIdx - 1];
      const thresholdRank = Math.ceil((nextLeague.range[1] / 100) * total);
      const thresholdUser = sorted[thresholdRank - 1];
      if (thresholdUser) {
        toNext = {
          rank: thresholdUser.rank!,
          apr: thresholdUser.aprTotal,
          address: thresholdUser.address,
          leagueName: nextLeague.name,
          icon: nextLeague.icon,
        };
      }
    }
  }

  // Generate keyframes for each league
  const keyframesStyles = ANIMAL_LEAGUES.map(
    (l) => `
      @keyframes glow${l.name} {
        0% {
          box-shadow: 0 0 4px ${l.color}44;
        }
        100% {
          box-shadow: 0 0 16px ${l.color}aa;
        }
      }
    `
  ).join("\n");

  // Medal for top 3
  function getMedal(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  }

  // Render a table row
  function renderRow(s: StakerRow, highlight = false) {
    const league = getLeague(s.rank!, total);
    const isUser = s.address === address;
    const medal = getMedal(s.rank!);

    return (
      <tr
        key={s.address}
        style={{
          background: isUser
            ? "linear-gradient(90deg, #ffe082 0%, #fffde4 100%)"
            : highlight
            ? "#202225"
            : "#181a1b",
          border: isUser ? `2.5px solid ${league.color}` : "1px solid #2f3136",
          boxShadow: isUser ? `0 0 16px 2px ${league.color}88` : "none",
          color: isUser ? "#181a1b" : "#fff",
          fontWeight: isUser ? 900 : 500,
          fontSize: isUser ? (isMobile ? 15 : 17) : (isMobile ? 13 : 15),
          borderRadius: isUser ? 8 : 0,
          transition: "all 0.25s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget.style.background = isUser
            ? "linear-gradient(90deg, #ffecb3 0%, #fffde7 100%)"
            : "#23272a");
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style.background = isUser
            ? "linear-gradient(90deg, #ffe082 0%, #fffde4 100%)"
            : "#181a1b");
        }}
      >
        <td style={{ textAlign: "center", fontWeight: 700, width: isMobile ? "30%" : "25%", padding: isMobile ? "6px 2px" : "8px 4px" }}>
          {medal ? medal : league.icon}{" "}
          <span style={{ color: league.color, fontWeight: 900 }}>#{s.rank}</span>
        </td>
        <td style={{ textAlign: "center", fontWeight: 700, width: isMobile ? "30%" : "30%", padding: isMobile ? "6px 2px" : "8px 4px" }}>
          {typeof s.aprTotal === "number" && !isNaN(s.aprTotal)
            ? Number(s.aprTotal).toFixed(2) + "%"
            : "—"}
        </td>
        <td style={{ textAlign: "center", fontWeight: 700, width: isMobile ? "40%" : "45%", padding: isMobile ? "6px 2px" : "8px 4px" }}>
          <span
            style={{
              background: `linear-gradient(135deg, ${league.color}99, ${league.color})`,
              padding: isMobile ? "3px 6px" : "4px 8px",
              borderRadius: 20,
              color: "#fff",
              fontWeight: 800,
              boxShadow: `0 0 8px ${league.color}66`,
              animation: `glow${league.name} 2s ease-in-out infinite alternate`,
              display: "inline-block",
              fontSize: isMobile ? 12 : 14,
            }}
          >
            {league.icon} {league.name}
            {isUser && (
              <span style={{ marginLeft: 6, color: "#1976d2" }}>(You)</span>
            )}
          </span>
        </td>
      </tr>
    );
  }

  // Render table header
  function renderHeader() {
    return (
      <tr style={{ background: "#23272a", color: "#ffe082" }}>
        <th style={{ textAlign: "center", fontWeight: 900, width: isMobile ? "30%" : "25%", padding: isMobile ? "6px 2px" : "8px 4px", fontSize: isMobile ? 14 : 16 }}>Rank</th>
        <th style={{ textAlign: "center", fontWeight: 900, width: isMobile ? "30%" : "30%", padding: isMobile ? "6px 2px" : "8px 4px", fontSize: isMobile ? 14 : 16 }}>Total APR</th>
        <th style={{ textAlign: "center", fontWeight: 900, width: isMobile ? "40%" : "45%", padding: isMobile ? "6px 2px" : "8px 4px", fontSize: isMobile ? 14 : 16 }}>League</th>
      </tr>
    );
  }

  // Render user ranking card
  function renderUserCard() {
    if (!user) return null;
    const league = getLeague(user.rank!, total);

    // Progress to next league
    let progress = 100;
    if (
      toNext &&
      typeof user.aprTotal === "number" &&
      typeof toNext.apr === "number"
    ) {
      progress = Math.min(100, (user.aprTotal / toNext.apr) * 100);
    }

    // Build X post
    const tweetText = toNext
      ? `I’m ranked #${user.rank} in the ${league.icon} ${league.name} League with ${user.aprTotal?.toFixed(
          2
        )}% APR at @ColombiaStaking 🚀\nNext stop: ${toNext.icon} ${toNext.leagueName} 🏆\nStake with me 👉 https://staking.colombia-staking.com/lock`
      : `I’m in the top ${league.icon} ${league.name} League at @ColombiaStaking with ${user.aprTotal?.toFixed(
          2
        )}% APR 🚀\nStake with me 👉 https://staking.colombia-staking.com/lock`;

    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
      tweetText
    )}`;

    return (
      <div
        style={{
          marginBottom: 20,
          background: "#1e1f22",
          borderRadius: 12,
          padding: "18px 20px",
          color: "#e5e5e5",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: `0 4px 12px ${league.color}55`,
          border: `1.5px solid ${league.color}77`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              background: `linear-gradient(135deg, ${league.color}99, ${league.color})`,
              padding: isMobile ? "5px 12px" : "6px 14px",
              borderRadius: 20,
              color: "#fff",
              fontWeight: 800,
              boxShadow: `0 0 8px ${league.color}66`,
              animation: `glow${league.name} 2s ease-in-out infinite alternate`,
              fontSize: isMobile ? 14 : 16,
            }}
          >
            {league.icon} {league.name}
          </span>
          <div
            style={{
              fontWeight: 700,
              fontSize: isMobile ? 12 : 14,
              padding: isMobile ? "2px 8px" : "2px 10px",
              borderRadius: 8,
              background: "#2a2d31",
              border: `1px solid ${league.color}55`,
              color: "#fff",
            }}
          >
            Rank #{user.rank}
          </div>
        </div>

        {/* APR */}
        <div style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14 }}>
          APR: {user.aprTotal?.toFixed(2) ?? "—"}%
        </div>

        {/* Progress bar */}
        {toNext && (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: isMobile ? 11 : 12, marginBottom: 6, color: "#aaa" }}>
              Progress to {toNext.icon} {toNext.leagueName} (
              {toNext.apr?.toFixed(2)}% APR)
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 6,
                background: "#2f3136",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${league.color}, #fff)`,
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        )}

        {/* Share button */}
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 14,
            alignSelf: "flex-start",
            background: `linear-gradient(135deg, ${league.color}, #6ee7c7)`,
            color: "#fff",
            fontSize: isMobile ? 12 : 13,
            fontWeight: 600,
            padding: isMobile ? "6px 10px" : "7px 12px",
            borderRadius: 8,
            textAlign: "center",
            textDecoration: "none",
            boxShadow: `0 2px 8px ${league.color}66`,
          }}
        >
          Share on X
        </a>
      </div>
    );
  }

  // Build final table rows
  const filteredUserRows = userRows.filter(
    (r) => !top5.some((t) => t.address === r.address)
  );
  const tableRows: JSX.Element[] = [
    ...top5.map((s) => renderRow(s, false)),
    <tr key="divider">
      <td colSpan={3} style={{ height: 10, background: "none" }}></td>
    </tr>,
    ...(filteredUserRows.length > 0
      ? filteredUserRows.map((s) => renderRow(s, false))
      : []),
  ];

  return (
    <div
      style={{
        margin: "32px auto 0 auto",
        background: "#181a1b",
        borderRadius: 14,
        boxShadow: "0 2px 16px #6ee7c7aa",
        padding: isMobile ? "20px 10px" : "24px 12px 20px 12px",
        maxWidth: 720,
        border: "2px solid #23272a",
      }}
    >
      <style>{keyframesStyles}</style>

      {/* User card */}
      {renderUserCard()}

      {/* Table */}
      <div
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          width: "100%",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: isMobile ? 300 : 320,
            borderCollapse: "separate",
            borderSpacing: 0,
            background: "none",
          }}
        >
          <thead>{renderHeader()}</thead>
          <tbody>{tableRows}</tbody>
        </table>
      </div>
    </div>
  );
}