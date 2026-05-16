import React, { useEffect, useState, useCallback } from 'react';
import Head from 'next/head';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { io, Socket } from 'socket.io-client';
import OrangeWheel from '../components/OrangeWheel';
import Chat from '../components/Chat';
import PlayerList from '../components/PlayerList';
import BetPanel from '../components/BetPanel';
import AccountPanel from '../components/AccountPanel';
import Countdown from '../components/Countdown';
import WinnerOverlay from '../components/WinnerOverlay';

interface Player {
  wallet: string;
  displayName: string;
  betAmount: number;
  percentage: number;
  color: string;
}

interface GameRound {
  id: string;
  status: 'waiting' | 'active' | 'spinning' | 'ended';
  players: Player[];
  totalPot: number;
  winnerWallet: string | null;
  winnerDisplayName: string | null;
  winnerShare: number;
  startedAt: number | null;
  endedAt: number | null;
  spinStartAt: number | null;
  countdownEndsAt: number | null;
}

interface WinnerInfo {
  winnerWallet: string;
  winnerDisplayName: string;
  winnerShare: number;
  totalPot: number;
}

export default function Home() {
  const { publicKey } = useWallet();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [round, setRound] = useState<GameRound | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [winnerInfo, setWinnerInfo] = useState<WinnerInfo | null>(null);
  const [showWinner, setShowWinner] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const wallet = publicKey?.toBase58() || null;

  useEffect(() => {
    const s = io('http://5.56.24.71:3001', { transports: ['websocket', 'polling'] });

    s.on('connect', () => {
      setConnected(true);
      s.emit('get_state');
    });

    s.on('disconnect', () => setConnected(false));

    s.on('round_update', (r: GameRound) => {
      setRound(r);
      setIsSpinning(r.status === 'spinning');
    });

    s.on('spin_started', () => {
      setIsSpinning(true);
    });

    s.on('winner_announced', (info: WinnerInfo) => {
      setWinnerInfo(info);
      setShowWinner(true);
      setIsSpinning(false);
    });

    s.on('new_round', () => {
      setIsSpinning(false);
      setWinnerInfo(null);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    if (!wallet || !socket) return;
    socket.emit('register_user', {
      wallet,
      displayName: displayName || wallet.slice(0, 4) + '…' + wallet.slice(-4),
    });
  }, [wallet, socket]);

  const handleDisplayNameChange = useCallback((name: string) => {
    setDisplayName(name);
    if (wallet && socket) {
      socket.emit('register_user', { wallet, displayName: name });
    }
  }, [wallet, socket]);

  const myPlayer = round?.players.find(p => p.wallet === wallet);
  const myBet = myPlayer?.betAmount || 0;

  return (
    <>
      <Head>
        <title>🍊 Orange Jackpot — Solana Casino</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

        {/* Left Sidebar: Chat */}
        <div style={{ width: chatOpen ? '260px' : '0', minWidth: chatOpen ? '260px' : '0', transition: 'all 0.3s ease', overflow: 'hidden', flexShrink: 0 }}>
          <Chat socket={socket} currentWallet={wallet} currentDisplayName={displayName} isConnected={connected} />
        </div>

        {/* Chat toggle */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          style={{ position: 'absolute', left: chatOpen ? '260px' : '0', top: '50%', transform: 'translateY(-50%)', zIndex: 50, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '0 6px 6px 0', padding: '12px 6px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', transition: 'left 0.3s' }}
        >
          {chatOpen ? '◀' : '💬'}
        </button>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <header style={{ borderBottom: '1px solid var(--border-color)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>🍊</span>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '18px', color: 'var(--orange-bright)', letterSpacing: '0.02em', lineHeight: 1 }}>ORANGE JACKPOT</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SOLANA · DEVNET</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '4px 12px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#26DE81' : '#FC5C65', boxShadow: connected ? '0 0 6px #26DE81' : 'none' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{connected ? 'LIVE' : 'CONNECTING'}</span>
            </div>

            {round && round.totalPot > 0 && (
              <div style={{ marginLeft: '8px', background: 'rgba(255,107,0,0.1)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: '20px', padding: '4px 14px', fontSize: '13px', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--orange-bright)' }}>
                🏆 {(round.totalPot / 1_000_000_000).toFixed(4)} SOL
              </div>
            )}

            <div style={{ marginLeft: 'auto' }}>
              <WalletMultiButton />
            </div>
          </header>

          {/* Game area */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: '0', minHeight: 0 }}>

            {/* Center */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '20px' }}>
              <div style={{ width: '100%', maxWidth: '420px' }}>
                <Countdown endsAt={round?.countdownEndsAt || null} status={round?.status || 'waiting'} />
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSpinning && (
                  <div style={{ position: 'absolute', width: 420, height: 420, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#FF6B00', borderRightColor: '#FF9F1C', animation: 'spin-jackpot 0.8s linear infinite', zIndex: 0 }} />
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <OrangeWheel players={round?.players || []} totalPot={round?.totalPot || 0} isSpinning={isSpinning} winnerWallet={round?.winnerWallet || null} size={380} />
                </div>
              </div>

              {(!round || round.players.length === 0) && (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '300px', lineHeight: 1.6 }}>
                  The orange awaits its first slice. Place a bet to claim your piece of the jackpot!
                </p>
              )}

              <div style={{ width: '100%', maxWidth: '520px' }}>
                <PlayerList players={round?.players || []} totalPot={round?.totalPot || 0} winnerWallet={round?.winnerWallet || null} currentWallet={wallet} />
              </div>
            </div>

            {/* Right sidebar */}
            <div style={{ borderLeft: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
              <AccountPanel displayName={displayName} onDisplayNameChange={handleDisplayNameChange} />
              <BetPanel socket={socket} displayName={displayName} roundStatus={round?.status || 'waiting'} myBet={myBet} isConnected={connected} />

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: '12px' }}>HOW IT WORKS</div>
                {[
                  ['🍊', 'Buy a slice of the orange with SOL'],
                  ['📈', 'Bigger bet = bigger slice = more chance'],
                  ['⏳', 'Jackpot spins once 2+ players join'],
                  ['🎰', 'Random spin picks the winner by %'],
                  ['💰', 'Winner gets 95% of the total pot'],
                ].map(([icon, text]) => (
                  <div key={text as string} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                Orange Jackpot · Solana Devnet<br />
                Provably Fair · 5% House Edge
              </div>
            </div>
          </div>
        </div>
      </div>

      {showWinner && winnerInfo && (
        <WinnerOverlay
          winnerWallet={winnerInfo.winnerWallet}
          winnerDisplayName={winnerInfo.winnerDisplayName}
          winnerShare={winnerInfo.winnerShare}
          totalPot={winnerInfo.totalPot}
          isYou={winnerInfo.winnerWallet === wallet}
          onClose={() => { setShowWinner(false); setWinnerInfo(null); }}
        />
      )}
    </>
  );
}
