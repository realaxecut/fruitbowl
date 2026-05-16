import React from 'react';

interface Player {
  wallet: string;
  displayName: string;
  betAmount: number;
  percentage: number;
  color: string;
}

interface PlayerListProps {
  players: Player[];
  totalPot: number;
  winnerWallet: string | null;
  currentWallet: string | null;
}

function lamportsToSol(l: number): string {
  return (l / 1_000_000_000).toFixed(4);
}

function shortenWallet(w: string): string {
  return w.slice(0, 4) + '…' + w.slice(-4);
}

export default function PlayerList({ players, totalPot, winnerWallet, currentWallet }: PlayerListProps) {
  const sorted = [...players].sort((a, b) => b.betAmount - a.betAmount);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '13px',
            color: 'var(--text-secondary)',
            letterSpacing: '0.05em',
          }}
        >
          SLICES ({players.length})
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          POT: <span style={{ color: 'var(--orange-soft)', fontWeight: 700 }}>
            {lamportsToSol(totalPot)} SOL
          </span>
        </span>
      </div>

      {/* Player rows */}
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
            }}
          >
            No players yet. Place a bet to join!
          </div>
        ) : (
          sorted.map((player, i) => {
            const isWinner = winnerWallet === player.wallet;
            const isYou = currentWallet === player.wallet;

            return (
              <div
                key={player.wallet}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(45,26,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: isWinner
                    ? 'rgba(57,255,138,0.08)'
                    : isYou
                    ? 'rgba(255,107,0,0.06)'
                    : 'transparent',
                  transition: 'background 0.2s',
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    width: '16px',
                    textAlign: 'center',
                  }}
                >
                  {i + 1}
                </span>

                {/* Color swatch */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: player.color,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${player.color}80`,
                  }}
                />

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontFamily: 'Syne, sans-serif',
                      fontWeight: 600,
                      color: isWinner ? '#39ff8a' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {player.displayName}
                    {isYou && (
                      <span
                        style={{
                          fontSize: '9px',
                          background: 'rgba(255,107,0,0.2)',
                          color: 'var(--orange-soft)',
                          border: '1px solid rgba(255,107,0,0.3)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                        }}
                      >
                        YOU
                      </span>
                    )}
                    {isWinner && (
                      <span
                        style={{
                          fontSize: '9px',
                          background: 'rgba(57,255,138,0.15)',
                          color: '#39ff8a',
                          border: '1px solid rgba(57,255,138,0.3)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                        }}
                      >
                        👑 WINNER
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {shortenWallet(player.wallet)}
                  </div>
                </div>

                {/* Bet and percentage */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--orange-soft)',
                      fontWeight: 700,
                    }}
                  >
                    {lamportsToSol(player.betAmount)} SOL
                  </div>
                  <div style={{ fontSize: '10px', color: player.color }}>
                    {player.percentage.toFixed(2)}%
                  </div>
                </div>

                {/* Percentage bar */}
                <div
                  style={{
                    width: '40px',
                    height: '4px',
                    background: 'var(--border-color)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: `${player.percentage}%`,
                      height: '100%',
                      background: player.color,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
