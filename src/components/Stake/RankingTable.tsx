import { useColsAprContext } from "../../context/ColsAprContext";
import { useGetAccountInfo } from "@multiversx/sdk-dapp/hooks/account/useGetAccountInfo";
import { useEffect, useState } from "react";

// Types
type StakerRow = {
  address: string;
  aprTotal: number | null | undefined;
  rank?: number;
  colsStaked?: number;
  egldStaked?: number;
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
  { name: "Leviathan", icon: "🐉", color: "#9c27b0", range: [0, 1], gradient: "linear-gradient(135deg, #9c27b0, #7b1fa2)" },
  { name: "Whale", icon: "🐋", color: "#2196f3", range: [1, 5], gradient: "linear-gradient(135deg, #2196f3, #1565c0)" },
  { name: "Shark", icon: "🦈", color: "#03a9f4", range: [5, 15], gradient: "linear-gradient(135deg, #03a9f4, #0097a7)" },
  { name: "Dolphin", icon: "🐬", color: "#00bcd4", range: [15, 30], gradient: "linear-gradient(135deg, #00bcd4, #009688)" },
  { name: "Pufferfish", icon: "🐡", color: "#4caf50", range: [30, 50], gradient: "linear-gradient(135deg, #4caf50, #388e3c)" },
  { name: "Fish", icon: "🐟", color: "#8bc34a", range: [50, 70], gradient: "linear-gradient(135deg, #8bc34a, #689f38)" },
  { name: "Crab", icon: "🦀", color: "#ff9800", range: [70, 90], gradient: "linear-gradient(135deg, #ff9800, #f57c00)" },
  { name: "Shrimp", icon: "🦐", color: "#f44336", range: [90, 100], gradient: "linear-gradient(135deg, #f44336, #d32f2f)" },
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

// Theme colors
const theme = {
  primary: '#62dbb8',
  primaryDark: '#4bc9a1',
  accent: '#d33682',
  background: '#0a0a0a',
  cardBg: '#1a1a1a',
  cardBgHover: '#252525',
  textPrimary: '#ffffff',
  textSecondary: '#a0a0a0',
  border: 'rgba(98, 219, 184, 0.2)',
};

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

  // Generate keyframes for glow animations
  const keyframesStyles = ANIMAL_LEAGUES.map(
    (l) => `
      @keyframes glow${l.name} {
        0% { box-shadow: 0 0 4px ${l.color}44; }
        100% { box-shadow: 0 0 16px ${l.color}aa; }
      }
      @keyframes pulse${l.name} {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
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
            ? `linear-gradient(90deg, ${league.color}22, ${league.color}11)`
            : highlight
            ? theme.cardBgHover
            : theme.cardBg,
          border: isUser 
            ? `2px solid ${league.color}` 
            : `1px solid ${theme.border}`,
          boxShadow: isUser 
            ? `0 4px 20px ${league.color}44` 
            : "none",
          color: theme.textPrimary,
          fontWeight: isUser ? 700 : 500,
          fontSize: isMobile ? 13 : 15,
        }}
      >
        <td style={{ 
          textAlign: "center", 
          fontWeight: 700, 
          width: isMobile ? "30%" : "25%", 
          padding: isMobile ? "12px 8px" : "14px 12px",
          borderRadius: isUser ? "8px 0 0 8px" : 0,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {medal && <span style={{ fontSize: 18 }}>{medal}</span>}
            <span style={{ 
              color: league.color, 
              fontWeight: 800,
              fontSize: isMobile ? 14 : 16,
            }}>#{s.rank}</span>
          </span>
        </td>
        <td style={{ 
          textAlign: "center", 
          fontWeight: 700, 
          width: isMobile ? "35%" : "30%", 
          padding: isMobile ? "12px 8px" : "14px 12px",
          color: theme.primary,
          fontSize: isMobile ? 14 : 16,
        }}>
          {typeof s.aprTotal === "number" && !isNaN(s.aprTotal)
            ? `${Number(s.aprTotal).toFixed(2)}%`
            : "—"}
        </td>
        <td style={{ 
          textAlign: "center", 
          fontWeight: 700, 
          width: isMobile ? "35%" : "45%", 
          padding: isMobile ? "12px 8px" : "14px 12px",
          borderRadius: isUser ? "0 8px 8px 0" : 0,
        }}>
          <span
            style={{
              background: league.gradient,
              padding: isMobile ? "4px 10px" : "6px 14px",
              borderRadius: 20,
              color: "#fff",
              fontWeight: 800,
              boxShadow: `0 2px 12px ${league.color}66`,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: isMobile ? 12 : 14,
            }}
          >
            <span>{league.icon}</span>
            <span>{league.name}</span>
            {isUser && (
              <span style={{ 
                marginLeft: 4, 
                color: "#fff", 
                fontSize: 11,
                background: "rgba(255,255,255,0.3)",
                padding: "2px 6px",
                borderRadius: 8,
              }}>
                You
              </span>
            )}
          </span>
        </td>
      </tr>
    );
  }

  // Render table header
  function renderHeader() {
    return (
      <tr style={{ 
        background: theme.cardBgHover, 
        borderBottom: `2px solid ${theme.border}`,
      }}>
        <th style={{ 
          textAlign: "center", 
          fontWeight: 700, 
          width: isMobile ? "30%" : "25%", 
          padding: isMobile ? "12px 8px" : "14px 12px", 
          fontSize: isMobile ? 12 : 14,
          color: theme.primary,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>Rank</th>
        <th style={{ 
          textAlign: "center", 
          fontWeight: 700, 
          width: isMobile ? "35%" : "30%", 
          padding: isMobile ? "12px 8px" : "14px 12px", 
          fontSize: isMobile ? 12 : 14,
          color: theme.primary,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>APR</th>
        <th style={{ 
          textAlign: "center", 
          fontWeight: 700, 
          width: isMobile ? "35%" : "45%", 
          padding: isMobile ? "12px 8px" : "14px 12px", 
          fontSize: isMobile ? 12 : 14,
          color: theme.primary,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>League</th>
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
      ? `I'm ranked #${user.rank} in the ${league.icon} ${league.name} League with ${user.aprTotal?.toFixed(2)}% APR at @ColombiaStaking 🚀\nNext stop: ${toNext.icon} ${toNext.leagueName} 🏆\nStake with me 👉 https://staking.colombia-staking.com/stake`
      : `I'm in the top ${league.icon} ${league.name} League at @ColombiaStaking with ${user.aprTotal?.toFixed(2)}% APR 🚀\nStake with me 👉 https://staking.colombia-staking.com/stake`;

    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    return (
      <div
        style={{
          marginBottom: 24,
          background: theme.cardBg,
          borderRadius: 20,
          padding: isMobile ? "20px 16px" : "24px",
          color: theme.textPrimary,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: `0 4px 24px ${league.color}44`,
          border: `1px solid ${league.color}66`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                background: league.gradient,
                padding: isMobile ? "8px 16px" : "10px 20px",
                borderRadius: 50,
                color: "#fff",
                fontWeight: 800,
                boxShadow: `0 4px 16px ${league.color}66`,
                fontSize: isMobile ? 14 : 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: isMobile ? 18 : 20 }}>{league.icon}</span>
              {league.name}
            </span>
          </div>
          <div
            style={{
              fontWeight: 700,
              fontSize: isMobile ? 14 : 16,
              padding: isMobile ? "6px 14px" : "8px 18px",
              borderRadius: 50,
              background: theme.cardBgHover,
              border: `1px solid ${theme.border}`,
              color: theme.primary,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ color: theme.textSecondary }}>Rank</span>
            <span style={{ fontWeight: 800 }}>#{user.rank}</span>
            <span style={{ color: theme.textSecondary, fontSize: 12 }}>of {total}</span>
          </div>
        </div>

        {/* APR Display */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'baseline', 
          gap: 8,
          flexWrap: 'wrap',
        }}>
          <span style={{ 
            fontWeight: 700, 
            fontSize: isMobile ? 28 : 36, 
            color: theme.primary,
            lineHeight: 1,
          }}>
            {user.aprTotal?.toFixed(2) ?? "—"}%
          </span>
          <span style={{ 
            color: theme.textSecondary, 
            fontSize: 14,
          }}>
            Total APR
          </span>
        </div>

        {/* Progress bar */}
        {toNext && (
          <div style={{ marginTop: 4 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 8,
            }}>
              <span style={{ 
                fontSize: isMobile ? 12 : 14, 
                color: theme.textSecondary 
              }}>
                Progress to {toNext.icon} {toNext.leagueName}
              </span>
              <span style={{ 
                fontSize: isMobile ? 12 : 14, 
                color: league.color,
                fontWeight: 600,
              }}>
                {progress.toFixed(0)}%
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: theme.cardBgHover,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: league.gradient,
                  transition: "width 0.6s ease",
                  borderRadius: 4,
                }}
              />
            </div>
            <div style={{ 
              fontSize: 12, 
              color: theme.textSecondary, 
              marginTop: 4,
            }}>
              Target: {toNext.apr?.toFixed(2)}% APR
            </div>
          </div>
        )}

        {/* Share button */}
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 8,
            alignSelf: "flex-start",
            background: league.gradient,
            color: "#fff",
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            padding: isMobile ? "10px 20px" : "12px 24px",
            borderRadius: 50,
            textAlign: "center",
            textDecoration: "none",
            boxShadow: `0 4px 16px ${league.color}44`,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow = `0 6px 24px ${league.color}66`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = `0 4px 16px ${league.color}44`;
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
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
    ...(filteredUserRows.length > 0
      ? [
          <tr key="divider">
            <td colSpan={3} style={{ height: 16, background: "transparent" }}></td>
          </tr>,
          ...filteredUserRows.map((s) => renderRow(s, false)),
        ]
      : []),
  ];

  return (
    <div
      style={{
        margin: "32px auto 0 auto",
        background: theme.cardBg,
        borderRadius: 20,
        boxShadow: `0 4px 24px rgba(0,0,0,0.3)`,
        padding: isMobile ? "20px 12px" : "24px 20px",
        maxWidth: 720,
        border: `1px solid ${theme.border}`,
      }}
    >
      <style>{keyframesStyles}</style>

      {/* Section title */}
      <h3 style={{
        margin: "0 0 20px 0",
        padding: "0 0 16px 0",
        borderBottom: `1px solid ${theme.border}`,
        fontSize: isMobile ? 18 : 20,
        fontWeight: 700,
        color: theme.textPrimary,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{ fontSize: 24 }}>🏆</span>
        Leaderboard
      </h3>

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
            borderSpacing: "0 8px",
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