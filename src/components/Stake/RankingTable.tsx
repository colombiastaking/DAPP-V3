import { useColsAprContext } from "../../context/ColsAprContext";
import { useGetAccount } from "@multiversx/sdk-dapp/out/react/account/useGetAccount";
import { useEffect, useState } from "react";

// Types
type StakerRow = {
  address: string;
  aprTotal: number | null | undefined;
  rank?: number;
  colsStaked?: number;
  egldStaked?: number;
};

// Animal leagues with rank % ranges
const ANIMAL_LEAGUES = [
  { name: "Leviathan", icon: "🐉", color: "#9c27b0", range: [0, 1], gradient: "linear-gradient(135deg, #9c27b0, #7b1fa2)", image: "/leagues/leviathan.jpg", tier: "Diamond" },
  { name: "Whale", icon: "🐋", color: "#2196f3", range: [1, 5], gradient: "linear-gradient(135deg, #2196f3, #1565c0)", image: "/leagues/whale.jpg", tier: "Platinum" },
  { name: "Shark", icon: "🦈", color: "#03a9f4", range: [5, 15], gradient: "linear-gradient(135deg, #03a9f4, #0097a7)", image: "/leagues/Shark.jpg", tier: "Gold" },
  { name: "Dolphin", icon: "🐬", color: "#00bcd4", range: [15, 30], gradient: "linear-gradient(135deg, #00bcd4, #009688)", image: "/leagues/Dolphin.jpg", tier: "Silver" },
  { name: "Pufferfish", icon: "🐡", color: "#4caf50", range: [30, 50], gradient: "linear-gradient(135deg, #4caf50, #388e3c)", image: "/leagues/Pufferfish.jpg", tier: "Bronze" },
  { name: "Fish", icon: "🐟", color: "#8bc34a", range: [50, 70], gradient: "linear-gradient(135deg, #8bc34a, #689f38)", image: "/leagues/Fish.jpg", tier: "Iron" },
  { name: "Crab", icon: "🦀", color: "#ff9800", range: [70, 90], gradient: "linear-gradient(135deg, #ff9800, #f57c00)", image: "/leagues/Crab.jpg", tier: "Stone" },
  { name: "Shrimp", icon: "🦐", color: "#f44336", range: [90, 100], gradient: "linear-gradient(135deg, #f44336, #d32f2f)", image: "/leagues/Shrimp.jpg", tier: "Wood" },
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
  const account = useGetAccount();
  const address = account.address;

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

  // Medal for top 3
  function getMedal(rank: number) {
    if (rank === 1) return { emoji: "🥇", glow: "0 0 20px #ffd700" };
    if (rank === 2) return { emoji: "🥈", glow: "0 0 20px #c0c0c0" };
    if (rank === 3) return { emoji: "🥉", glow: "0 0 20px #cd7f32" };
    return null;
  }

  // Render rank card (big beautiful cards)
  function renderRankCard(s: StakerRow, _index: number) {
    const league = getLeague(s.rank!, total);
    const isUser = s.address === address;
    const medal = getMedal(s.rank!);

    return (
      <div
        key={s.address}
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 12 : 16,
          padding: isMobile ? "14px 12px" : "16px 20px",
          background: isUser 
            ? `linear-gradient(135deg, ${league.color}22, ${league.color}11)`
            : "rgba(255, 255, 255, 0.03)",
          borderRadius: 16,
          border: isUser 
            ? `2px solid ${league.color}`
            : "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: isUser 
            ? `0 8px 32px ${league.color}33`
            : "none",
          transition: "all 0.3s ease",
          cursor: "default",
        }}
      >
        {/* Rank Number / Medal */}
        <div style={{
          minWidth: isMobile ? 36 : 48,
          textAlign: "center",
        }}>
          {medal ? (
            <div style={{
              fontSize: isMobile ? 24 : 32,
              filter: medal.glow ? `drop-shadow(${medal.glow})` : "none",
            }}>
              {medal.emoji}
            </div>
          ) : (
            <div style={{
              fontSize: isMobile ? 16 : 20,
              fontWeight: 800,
              color: league.color,
            }}>
              #{s.rank}
            </div>
          )}
        </div>

        {/* League Badge - Big Animal */}
        <div style={{
          position: "relative",
          flexShrink: 0,
        }}>
          <img 
            src={league.image} 
            alt={league.name}
            style={{
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              borderRadius: 14,
              objectFit: "cover",
              border: `3px solid ${league.color}`,
              boxShadow: `0 4px 16px ${league.color}44`,
            }}
          />
          {/* League Icon Overlay */}
          <div style={{
            position: "absolute",
            bottom: -6,
            right: -6,
            background: league.gradient,
            borderRadius: "50%",
            width: isMobile ? 20 : 24,
            height: isMobile ? 20 : 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isMobile ? 10 : 12,
            border: "2px solid rgba(255,255,255,0.3)",
          }}>
            {league.icon}
          </div>
        </div>

        {/* League Name & Tier */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 14 : 16,
            fontWeight: 700,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}>
            {league.name}
            <span style={{
              fontSize: isMobile ? 9 : 10,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              background: league.gradient,
              padding: "3px 8px",
              borderRadius: 10,
              color: "#fff",
              fontWeight: 600,
            }}>
              {league.tier}
            </span>
            {isUser && (
              <span style={{
                fontSize: isMobile ? 10 : 11,
                background: "rgba(98, 219, 184, 0.2)",
                color: "#62dbb8",
                padding: "3px 8px",
                borderRadius: 10,
                fontWeight: 600,
              }}>
                You
              </span>
            )}
          </div>
          <div style={{
            fontSize: isMobile ? 11 : 12,
            color: "rgba(255, 255, 255, 0.5)",
            marginTop: 2,
          }}>
            {((s.rank! / total) * 100).toFixed(1)}% percentile
          </div>
        </div>

        {/* APR */}
        <div style={{
          textAlign: "right",
          minWidth: isMobile ? 60 : 80,
        }}>
          <div style={{
            fontSize: isMobile ? 18 : 22,
            fontWeight: 800,
            color: "#62dbb8",
          }}>
            {typeof s.aprTotal === "number" && !isNaN(s.aprTotal)
              ? `${Number(s.aprTotal).toFixed(2)}%`
              : "—"}
          </div>
          <div style={{
            fontSize: isMobile ? 10 : 11,
            color: "rgba(255, 255, 255, 0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            APR
          </div>
        </div>
      </div>
    );
  }

  // Render user ranking card
  function renderUserCard() {
    if (!user) return null;
    const league = getLeague(user.rank!, total);

    // Progress to next league
    let progress = 100;
    const currentIdx = ANIMAL_LEAGUES.findIndex((l) => l.name === league.name);
    if (currentIdx > 0) {
      const nextLeague = ANIMAL_LEAGUES[currentIdx - 1];
      const thresholdRank = Math.ceil((nextLeague.range[1] / 100) * total);
      const thresholdUser = sorted[thresholdRank - 1];
      if (thresholdUser && typeof thresholdUser.aprTotal === "number" && typeof user.aprTotal === "number") {
        progress = Math.min(100, (user.aprTotal / thresholdUser.aprTotal) * 100);
      }
    }

    // Build X post
    const tweetText = currentIdx > 0
      ? `I'm ranked #${user.rank} in the ${league.icon} ${league.name} League with ${user.aprTotal?.toFixed(2)}% APR at @ColombiaStaking 🚀\nNext stop: ${ANIMAL_LEAGUES[currentIdx - 1].icon} ${ANIMAL_LEAGUES[currentIdx - 1].name} 🏆\nStake with me 👉 https://staking.colombia-staking.com/stake`
      : `I'm in the top ${league.icon} ${league.name} League at @ColombiaStaking with ${user.aprTotal?.toFixed(2)}% APR 🚀\nStake with me 👉 https://staking.colombia-staking.com/stake`;

    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    return (
      <div
        style={{
          marginBottom: 24,
          background: `linear-gradient(135deg, ${league.color}15, ${league.color}08)`,
          borderRadius: 24,
          padding: isMobile ? "20px 16px" : "28px",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: `0 8px 40px ${league.color}33`,
          border: `1px solid ${league.color}44`,
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Header Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          {/* League Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img 
              src={league.image} 
              alt={league.name} 
              style={{ 
                width: isMobile ? 56 : 72, 
                height: isMobile ? 56 : 72, 
                borderRadius: 18, 
                objectFit: 'cover',
                border: `4px solid ${league.color}`,
                boxShadow: `0 6px 24px ${league.color}55`,
              }} 
            />
            <div>
              <div style={{
                fontSize: isMobile ? 12 : 13,
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 4,
              }}>
                Your League
              </div>
              <div style={{
                fontSize: isMobile ? 24 : 28,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}>
                {league.icon} {league.name}
              </div>
              <div style={{
                fontSize: isMobile ? 11 : 12,
                color: league.color,
                fontWeight: 600,
                marginTop: 4,
              }}>
                {league.tier} Tier
              </div>
            </div>
          </div>

          {/* Rank Badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: isMobile ? "12px 20px" : "16px 28px",
              borderRadius: 16,
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${league.color}44`,
            }}
          >
            <div style={{ 
              fontSize: isMobile ? 12 : 13,
              color: "rgba(255,255,255,0.6)",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}>
              Rank
            </div>
            <div style={{ 
              fontSize: isMobile ? 32 : 40, 
              fontWeight: 800, 
              color: league.color,
              lineHeight: 1,
            }}>
              #{user.rank}
            </div>
            <div style={{ 
              fontSize: isMobile ? 11 : 12, 
              color: "rgba(255,255,255,0.5)",
              marginTop: 4,
            }}>
              of {total.toLocaleString()}
            </div>
          </div>
        </div>

        {/* APR Display */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'baseline', 
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span style={{ 
            fontWeight: 800, 
            fontSize: isMobile ? 36 : 48, 
            color: "#62dbb8",
            lineHeight: 1,
            textShadow: "0 0 30px rgba(98, 219, 184, 0.5)",
          }}>
            {user.aprTotal?.toFixed(2) ?? "—"}%
          </span>
          <span style={{ 
            color: "rgba(255, 255, 255, 0.6)", 
            fontSize: isMobile ? 14 : 16,
          }}>
            Total APR
          </span>
        </div>

        {/* Progress bar to next league */}
        {currentIdx > 0 && (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{ 
                fontSize: isMobile ? 12 : 14, 
                color: "rgba(255,255,255,0.7)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}>
                {ANIMAL_LEAGUES[currentIdx - 1].icon} Next: {ANIMAL_LEAGUES[currentIdx - 1].name}
              </span>
              <span style={{ 
                fontSize: isMobile ? 12 : 14, 
                color: ANIMAL_LEAGUES[currentIdx - 1].color,
                fontWeight: 600,
              }}>
                {progress.toFixed(0)}%
              </span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 5,
                background: "rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${league.color}, ${ANIMAL_LEAGUES[currentIdx - 1].color})`,
                  transition: "width 0.6s ease",
                  borderRadius: 5,
                  boxShadow: `0 0 20px ${league.color}66`,
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
            alignSelf: "flex-start",
            background: `linear-gradient(135deg, ${league.color}, ${league.color}cc)`,
            color: "#fff",
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            padding: isMobile ? "12px 20px" : "14px 28px",
            borderRadius: 14,
            textDecoration: "none",
            boxShadow: `0 4px 20px ${league.color}44`,
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            transition: "all 0.2s ease",
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

  // Filter user rows from top5
  const filteredUserRows = userRows.filter(
    (r) => !top5.some((t) => t.address === r.address)
  );

  return (
    <div
      style={{
        margin: "32px auto 0 auto",
        background: "rgba(20, 20, 25, 0.8)",
        borderRadius: 24,
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
        padding: isMobile ? "20px 16px" : "28px 24px",
        maxWidth: 680,
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Section title */}
      <h3 style={{
        margin: "0 0 24px 0",
        padding: "0 0 16px 0",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        fontSize: isMobile ? 20 : 24,
        fontWeight: 700,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <span style={{ fontSize: 28 }}>🏆</span>
        Leaderboard
      </h3>

      {/* User card */}
      {renderUserCard()}

      {/* Top 5 Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: isMobile ? 12 : 13,
          color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          marginBottom: 12,
          paddingLeft: 4,
        }}>
          Top Stakers
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {top5.map((s, i) => renderRankCard(s, i))}
        </div>
      </div>

      {/* User's surrounding rows */}
      {filteredUserRows.length > 0 && (
        <div>
          <div style={{
            fontSize: isMobile ? 12 : 13,
            color: "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            marginBottom: 12,
            paddingLeft: 4,
            marginTop: 16,
          }}>
            Your Position
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredUserRows.map((s) => renderRankCard(s, -1))}
          </div>
        </div>
      )}
    </div>
  );
}
