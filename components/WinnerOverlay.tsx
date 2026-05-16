import React, { useEffect, useState } from 'react';

interface WinnerOverlayProps {
  winnerDisplayName: string;
  winnerWallet: string;
  winnerShare: number;
  totalPot: number;
  isYou: boolean;
  onClose: () => void;
}

function Confetti() {
  const pieces = Array.from({ length: 30 });
  const colors = ['#FF6B35', '#FF9F1C', '#FFBF69', '#26DE81', '#45AAF2', '#A55EEA', '#FD79A8'];
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {pieces.map((_, i) => {
        const color = colors[i % colors.length];
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const size = 6 + Math.random() * 8;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: '-10px',
              width: size,
              height: size,
              borderRadius: Math.random() > 0.5 ? '50%' : '0',
              background: color,
              animation: `confetti-fall ${1.5 + Math.random()}s ${delay}s ease-in forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

export default function WinnerOverlay({
  winnerDisplayName,
  winnerWallet,
  winnerShare,
  totalPot,
  isYou,
  onClose,
}: WinnerOverlayProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!visible) return null;

  const solWon = (winnerShare / 1_000_000_000).toFixed(4);
  const totalSol = (totalPot / 1_000_000_000).toFixed(4);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <Confetti />
        <div
          style={{
            background: 'var(--bg-card)',
            border: '2px solid rgba(255,107,0,0.5)',
            borderRadius: '20px',
            padding: '48px 56px',
            textAlign: 'center',
            boxShadow: '0 0 60px rgba(255,107,0,0.3), 0 0 120px rgba(255,107,0,0.15)',
            position: 'relative',
            zIndex: 1,
            maxWidth: '440px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Orange emoji */}
          <div style={{ fontSize: '64px', marginBottom: '8px', lineHeight: 1 }}>🍊</div>

          {/* Winner label */}
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: '13px',
              letterSpacing: '0.2em',
              color: 'var(--text-muted)',
              marginBottom: '12px',
            }}
          >
            JACKPOT WINNER
          </div>

          {/* Winner name */}
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 800,
              fontSize: isYou ? '36px' : '28px',
              color: isYou ? '#39ff8a' : 'var(--orange-bright)',
              marginBottom: '8px',
              textShadow: isYou
                ? '0 0 30px rgba(57,255,138,0.6)'
                : '0 0 30px rgba(255,140,0,0.6)',
              animation: 'winner-flash 0.8s ease-in-out infinite',
            }}
          >
            {isYou ? '🎉 YOU WIN!' : winnerDisplayName}
          </div>

          {isYou && (
            <div
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
              }}
            >
              {winnerDisplayName}
            </div>
          )}

          {/* Amount */}
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontWeight: 700,
              fontSize: '32px',
              color: 'var(--orange-bright)',
              marginBottom: '4px',
            }}
          >
            {solWon} ◎
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            from {totalSol} SOL pot · 5% fee deducted
          </div>

          {/* Wallet */}
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'Space Mono, monospace',
              marginBottom: '24px',
              padding: '8px 14px',
              background: 'var(--bg-secondary)',
              borderRadius: '6px',
              display: 'inline-block',
            }}
          >
            {winnerWallet.slice(0, 8)}...{winnerWallet.slice(-8)}
          </div>

          <button
            onClick={onClose}
            className="btn-orange"
            style={{ display: 'block', width: '100%', padding: '12px', fontSize: '14px' }}
          >
            Next Round →
          </button>
        </div>
      </div>
    </div>
  );
}
