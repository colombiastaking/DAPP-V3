import { useColsAprContext } from "../../context/ColsAprContext";
import { useGetAccountInfo } from "@multiversx/sdk-dapp/hooks/account/useGetAccountInfo";
import { useEffect, useState } from "react";

// League colors and icons
const LEAGUES = [
  { name: "Gold", color: "#FFD700", icon: "🥇" },
  { name: "Silver", color: "#C0C0C0", icon: "🥈" },
  { name: "Bronze", color: "#CD7F32", icon: "🥉" }
];

// League assignment
function getLeague(rank: number, total: number) {
  const perLeague = Math.ceil(total / 3);
  if (rank <= perLeague) return 0; // Gold
  if (rank <= perLeague * 2) return 1; // Silver
  return 2; // Bronze
}

type StakerRow = {
  address: string;
  aprTotal: number | null | undefined;
  rank?: number;
};

type ToNextType = {
  rank: number;
  apr: number | null | undefined;
  address: string;
} | null;

export function RankingTable() {
  const { stakers, loading } = useColsAprContext();
  const { address } = useGetAccountInfo();

  // Responsive: detect mobile
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

  // Sort by APR descending, assign rank
  const sorted: StakerRow[] = [...stakers].sort((a, b) => (b.aprTotal ?? 0) - (a.aprTotal ?? 0));
  const total = sorted.length;
  sorted.forEach((s, i) => (s.rank = i + 1));

  // Leagues
  const perLeague = Math.ceil(total / 3);
  const leagueRanges: [number, number][] = [
    [1, perLeague],
    [perLeague + 1, perLeague * 2],
    [perLeague * 2 + 1, total]
  ];

  // Top 5
  const top5 = sorted.slice(0, 5);

  // Find user
  const userIdx = sorted.findIndex((s) => s.address === address);
  const user = userIdx !== -1 ? sorted[userIdx] : null;

  // User - 5 before, +5 after (centered on user)
  let userRows: StakerRow[] = [];
  if (user) {
    const start = Math.max(0, userIdx - 5);
    const end = Math.min(total, userIdx + 6);
    userRows = sorted.slice(start, end);
  }

  // Next league info
  let nextLeague: string | null = null;
  let toNext: ToNextType = null;
  if (user) {
    const userLeague = getLeague(user.rank!, total);
    if (userLeague < 2) {
      const nextLeagueIdx = userLeague;
      const nextLeagueName = LEAGUES[nextLeagueIdx].name;
      const nextLeagueEnd = leagueRanges[nextLeagueIdx][1];
      const thresholdRank = nextLeagueEnd;
      const thresholdUser = sorted[thresholdRank - 1];
      if (thresholdUser && user.rank! > thresholdRank) {
        toNext = {
          rank: thresholdRank,
          apr: thresholdUser.aprTotal,
          address: thresholdUser.address
        };
        nextLeague = nextLeagueName;
      } else if (userLeague === 1) {
        const goldEnd = leagueRanges[0][1];
        const goldUser = sorted[goldEnd - 1];
        toNext = {
          rank: goldEnd,
          apr: goldUser.aprTotal,
          address: goldUser.address
        };
        nextLeague = "Gold";
      }
    }
  }

  // Table row rendering (NO address column)
  function renderRow(s: StakerRow, highlight = false) {
    const leagueIdx = getLeague(s.rank!, total);
    const league = LEAGUES[leagueIdx];
    const isUser = s.address === address;

    const rankColor =
      isUser && league.name === "Gold"
        ? "#181a1b"
        : league.color;

    const rankTextShadow =
      isUser && league.name === "Gold"
        ? "0 1px 2px #fff, 0 0 2px #FFD700"
        : undefined;

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
          boxShadow: isUser
            ? `0 0 16px 2px ${league.color}88`
            : undefined,
          color: isUser ? "#181a1b" : "#fff",
          fontWeight: isUser ? 900 : 500,
          fontSize: isUser ? 17 : 15,
          borderRadius: isUser ? 8 : 0
        }}
      >
        <td style={{ textAlign: "center", fontWeight: 700 }}>
          {league.icon}{" "}
          <span
            style={{
              color: rankColor,
              fontWeight: 900,
              textShadow: rankTextShadow
            }}
          >
            #{s.rank}
          </span>
        </td>
        <td style={{ textAlign: "center", fontWeight: 700 }}>
          {typeof s.aprTotal === "number" && !isNaN(s.aprTotal)
            ? Number(s.aprTotal).toFixed(2) + "%"
            : "—"}
        </td>
        <td style={{ textAlign: "center", fontWeight: 700 }}>
          <span
            style={{
              color: league.color,
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 0.5
            }}
          >
            {league.name}
            {isUser && (
              <span style={{ marginLeft: 6, color: "#1976d2" }}>
                (You)
              </span>
            )}
          </span>
        </td>
      </tr>
    );
  }

  // Table header (NO address column)
  function renderHeader() {
    return (
      <tr style={{ background: "#23272a", color: "#ffe082" }}>
        <th style={{ textAlign: "center", fontWeight: 900 }}>Rank</th>
        <th style={{ textAlign: "center", fontWeight: 900 }}>Total APR</th>
        <th style={{ textAlign: "center", fontWeight: 900 }}>League</th>
      </tr>
    );
  }

  // League legend
  function renderLegend() {
    return (
      <div style={{ display: "flex", gap: 18, margin: "10px 0 0 0" }}>
        {LEAGUES.map((l) => (
          <span
            key={l.name}
            style={{
              color: l.color,
              fontWeight: 900,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            {l.icon} {l.name}
          </span>
        ))}
      </div>
    );
  }

  // Next league info
  function renderNextLeague() {
    if (!nextLeague || !toNext) return null;
    return (
      <div
        style={{
          margin: "18px 0 0 0",
          background: "#23272a",
          borderRadius: 8,
          padding: "12px 18px",
          color: "#fff",
          fontWeight: 600,
          fontSize: 15,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: `0 2px 12px ${LEAGUES.find(l => l.name === nextLeague)?.color}55`
        }}
      >
        <span>
          <b>Next League:</b>{" "}
          <span style={{ color: LEAGUES.find(l => l.name === nextLeague)?.color, fontWeight: 900 }}>
            {nextLeague}
          </span>
        </span>
        <span>
          <b>Reach at least:</b>{" "}
          <span style={{ color: "#ffe082", fontWeight: 900 }}>
            {toNext.apr !== null && toNext.apr !== undefined ? Number(toNext.apr).toFixed(2) + "%" : "—"}
          </span>
          {" "}APR (Rank #{toNext.rank})
        </span>
      </div>
    );
  }

  // Show: top 5, divider, user-5~user+5 (if user exists), no duplicates
  let tableRows: JSX.Element[] = [];
  const filteredUserRows = userRows.filter(r => !top5.some(t => t.address === r.address));
  tableRows = [
    ...top5.map((s) => renderRow(s, false)),
    <tr key="divider"><td colSpan={3} style={{ height: 10, background: "none" }}></td></tr>,
    ...(filteredUserRows.length > 0 ? filteredUserRows.map((s) => renderRow(s, false)) : [])
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
        border: "2.5px solid #23272a"
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: 20,
          color: "#ffe082",
          marginBottom: 8,
          textAlign: "center",
          letterSpacing: 0.5
        }}
      >
        🏆 Ranking Table
      </div>
      <div
        style={{
          color: "#fff",
          fontWeight: 600,
          fontSize: 15,
          textAlign: "center",
          marginBottom: 10
        }}
      >
        Top 5 Stakers · Your Position · Leagues
      </div>
      <div style={{
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        width: "100%"
      }}>
        <table
          style={{
            width: isMobile ? 480 : "100%",
            minWidth: 360,
            borderCollapse: "separate",
            borderSpacing: 0,
            background: "none"
          }}
        >
          <thead>{renderHeader()}</thead>
          <tbody>
            {tableRows}
          </tbody>
        </table>
      </div>
      {renderLegend()}
      {renderNextLeague()}
    </div>
  );
}
