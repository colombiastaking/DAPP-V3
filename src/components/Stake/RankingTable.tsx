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
    ) || ANIMAL_LEAGUES[ANIMAL_LEAGUES.length - 1] // default Shrimp
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

  // Render a table row
  function renderRow(s: StakerRow, highlight = false) {
    const league = getLeague(s.rank!, total);
    const isUser = s.address === address;

    return (
      <tr
        key={s.address}
        style={{
          background: isUser
            ? "linear-gradient(90deg, #ffe082 0%, #fffde4 100%)"
            : highlight
            ? "#23272a"
            : "#181a1b",
          border: isUser ? `2.5px solid ${league.color}` : undefined,
          boxShadow: isUser ? `0 0 16px 2px ${league.color}88` : undefined,
          color: isUser ? "#181a1b" : "#fff",
          fontWeight: isUser ? 900 : 500,
          fontSize: isUser ? 17 : 15,
          borderRadius: isUser ? 8 : 0,
        }}
      >
        <td style={{ textAlign: "center", fontWeight: 700 }}>
          {league.icon}{" "}
          <span style={{ color: league.color, fontWeight: 900 }}>#{s.rank}</span>
        </td>
        <td style={{ textAlign: "center", fontWeight: 700 }}>
          {typeof s.aprTotal === "number" && !isNaN(s.aprTotal)
            ? Number(s.aprTotal).toFixed(2) + "%"
            : "—"}
        </td>
        <td style={{ textAlign: "center", fontWeight: 700 }}>
          <span style={{ color: league.color, fontWeight: 900 }}>
            {league.name}
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
        <th style={{ textAlign: "center", fontWeight: 900 }}>Rank</th>
        <th style={{ textAlign: "center", fontWeight: 900 }}>Total APR</th>
        <th style={{ textAlign: "center", fontWeight: 900 }}>League</th>
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
        )}% APR at @ColombiaStaking 🚀\nNext stop: ${toNext.icon} ${toNext.leagueName} 🏆\nStake with me 👉 https://staking.colombia-staking.com`
      : `I’m in the top ${league.icon} ${league.name} League at @ColombiaStaking with ${user.aprTotal?.toFixed(
          2
        )}% APR 🚀\nStake with me 👉 https://staking.colombia-staking.com`;

    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
      tweetText
    )}`;

    return (
      <div
        style={{
          marginBottom: 16,
          background: "#1e1f22",
          borderRadius: 10,
          padding: "16px 18px",
          color: "#e5e5e5",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
          border: `1px solid ${league.color}55`,
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
          <div style={{ fontSize: 16, fontWeight: 700, color: league.color }}>
            {league.icon} {league.name}
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              padding: "2px 8px",
              borderRadius: 6,
              background: "#2a2d31",
              border: `1px solid ${league.color}55`,
              color: "#fff",
            }}
          >
            Rank #{user.rank}
          </div>
        </div>

        {/* APR */}
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          APR: {user.aprTotal?.toFixed(2) ?? "—"}%
        </div>

        {/* Progress bar */}
        {toNext && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12, marginBottom: 6, color: "#aaa" }}>
              Progress to {toNext.icon} {toNext.leagueName} (
              {toNext.apr?.toFixed(2)}% APR)
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "#2f3136",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: league.color,
                  transition: "width 0.4s ease",
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
            marginTop: 12,
            alignSelf: "flex-start",
            background: league.color,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "6px 10px",
            borderRadius: 6,
            textAlign: "center",
            textDecoration: "none",
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
        margin: "32px 0 0 0",
        background: "#181a1b",
        borderRadius: 14,
        boxShadow: "0 2px 16px #6ee7c7aa",
        padding: "24px 10px 18px 10px",
        maxWidth: 700,
        marginLeft: "auto",
        marginRight: "auto",
        border: "2.5px solid #23272a",
      }}
    >
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
            width: isMobile ? 480 : "100%",
            minWidth: 360,
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
