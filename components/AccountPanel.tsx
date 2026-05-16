import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface UserAccount {
  wallet: string;
  displayName: string;
  createdAt: number;
  totalWon: number;
  totalBet: number;
  gamesPlayed: number;
}

interface AccountPanelProps {
  onDisplayNameChange: (name: string) => void;
  displayName: string;
}

export default function AccountPanel({ onDisplayNameChange, displayName }: AccountPanelProps) {
  const { publicKey } = useWallet();
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState('');
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(false);

  const wallet = publicKey?.toBase58() || null;

  useEffect(() => {
    if (!wallet) return;
    fetchUser(wallet);
  }, [wallet]);

  const fetchUser = async (w: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user?wallet=${w}`);
      const data = await res.json();
      if (data.user) {
        setAccount(data.user);
        onDisplayNameChange(data.user.displayName);
      } else {
        // New user, set display name from wallet
        const shortName = w.slice(0, 4) + '…' + w.slice(-4);
        onDisplayNameChange(shortName);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const saveDisplayName = async () => {
    if (!wallet || !tempName.trim()) return;
    const name = tempName.trim().slice(0, 24);
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, displayName: name }),
      });
      const data = await res.json();
      if (data.user) {
        setAccount(data.user);
        onDisplayNameChange(data.user.displayName);
      }
    } catch (e) {
      console.error(e);
    }
    setEditing(false);
  };

  const lamportsToSol = (l: number) => (l / 1_000_000_000).toFixed(3);

  if (!wallet) return null;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      {/* Display name */}
      <div style={{ marginBottom: '14px' }}>
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginBottom: '6px',
            fontFamily: 'Syne, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          DISPLAY NAME
        </div>
        {editing ? (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value.slice(0, 24))}
              onKeyDown={(e) => e.key === 'Enter' && saveDisplayName()}
              autoFocus
              maxLength={24}
              placeholder="Enter name..."
              style={{ flex: 1, fontSize: '13px' }}
            />
            <button
              onClick={saveDisplayName}
              className="btn-orange"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '15px',
                fontFamily: 'Syne, sans-serif',
                fontWeight: 700,
                color: 'var(--orange-soft)',
              }}
            >
              {displayName}
            </span>
            <button
              onClick={() => {
                setTempName(displayName);
                setEditing(true);
              }}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              ✎ Edit
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {account && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '10px',
          }}
        >
          {[
            { label: 'GAMES', value: account.gamesPlayed },
            { label: 'WAGERED', value: `${lamportsToSol(account.totalBet)}◎` },
            { label: 'WON', value: `${lamportsToSol(account.totalWon)}◎` },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                padding: '8px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                {label}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  fontFamily: 'Syne, sans-serif',
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
