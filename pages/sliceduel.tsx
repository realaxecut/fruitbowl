import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { io, Socket } from 'socket.io-client';
import SettingsModal from '../components/SettingsModal';

const HOUSE_WALLET = process.env.NEXT_PUBLIC_HOUSE_WALLET || '';
const HOUSE_FEE = 0.05;

// ── Fruit definitions ─────────────────────────────────────────────────────────
const FRUITS = [
  { emoji: '🍉', name: 'Watermelon', color: '#48bb78', points: 1 },
  { emoji: '🍊', name: 'Orange',     color: '#ff8c00', points: 2 },
  { emoji: '🍋', name: 'Lemon',      color: '#f6e05e', points: 2 },
  { emoji: '🍇', name: 'Grape',      color: '#9f7aea', points: 3 },
  { emoji: '🍒', name: 'Cherry',     color: '#fc8181', points: 3 },
  { emoji: '🍍', name: 'Pineapple',  color: '#f59e0b', points: 4 },
  { emoji: '🍓', name: 'Strawberry', color: '#e53e3e', points: 4 },
];

// Bombs — slicing costs points
const BOMB_EMOJI = '💣';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FruitItem {
  id: number;
  x: number;        // % across canvas
  y: number;        // % down canvas
  vx: number;
  vy: number;
  size: number;
  fruitIdx: number;  // index into FRUITS (-1 = bomb)
  sliced: boolean;
  opacity: number;
}

interface Lobby {
  id: string;
  creatorWallet: string;
  creatorName: string;
  wagerLamports: number;
  createdAt: number;
  status: 'open' | 'matched' | 'playing' | 'ended';
  opponentWallet?: string;
  opponentName?: string;
}

type Phase = 'lobby' | 'countdown' | 'playing' | 'result';

const GAME_DURATION = 60; // seconds
const QUICK_AMOUNTS = ['0.01', '0.1', '0.5', '1'];

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SliceDuel() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const wallet = publicKey?.toBase58() || null;

  // ── Lobby state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('lobby');
  const [wagerInput, setWagerInput] = useState('');
  const [openLobbies, setOpenLobbies] = useState<Lobby[]>([]);
  const [myLobby, setMyLobby] = useState<Lobby | null>(null);
  const [matchedLobby, setMatchedLobby] = useState<Lobby | null>(null);
  const [betError, setBetError] = useState('');
  const [betLoading, setBetLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState<string | null>(null);
  const [lobbyCountdown, setLobbyCountdown] = useState(300); // 5 min timeout

  // ── Game state ────────────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [fruits, setFruits] = useState<FruitItem[]>([]);
  const [combo, setCombo] = useState(0);
  const [comboDisplay, setComboDisplay] = useState<{ val: number; ts: number } | null>(null);
  const [sliceTrail, setSliceTrail] = useState<{ x: number; y: number }[]>([]);

  // ── Result state ──────────────────────────────────────────────────────────
  const [playerWon, setPlayerWon] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalOpponentScore, setFinalOpponentScore] = useState(0);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [claimState, setClaimState] = useState<'idle' | 'claiming' | 'success' | 'error'>('idle');
  const [claimTx, setClaimTx] = useState('');
  const [claimError, setClaimError] = useState('');

  // ── Misc ──────────────────────────────────────────────────────────────────
  const [socket, setSocket] = useState<Socket | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [unclaimedTotal, setUnclaimedTotal] = useState(0);
  const [isGameLocked, setIsGameLocked] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const fruitsRef = useRef<FruitItem[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(0);
  const seedRngRef = useRef<(() => number) | null>(null);
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMouseDownRef = useRef(false);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const betTxSigRef = useRef<string | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const wagerLamportsRef = useRef(0);
  const lobbyCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Socket setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'https://fruitbowl.fun', {
      transports: ['websocket', 'polling'],
    });

    s.on('locked_games', (games: string[]) => {
      setIsGameLocked(games.includes('sliceduel'));
    });
    s.on('unclaimed_wins', (data: { totalLamports: number }) => {
      setUnclaimedTotal(data.totalLamports || 0);
    });
    s.on('sliceduel_lobbies', (lobbies: Lobby[]) => {
      setOpenLobbies(lobbies.filter(l => l.status === 'open' && l.creatorWallet !== wallet));
    });
    s.on('sliceduel_lobby_created', (lobby: Lobby) => {
      setMyLobby(lobby);
      startLobbyCountdown();
    });
    s.on('sliceduel_match_found', (data: { lobby: Lobby; seed: number; matchId: string }) => {
      matchIdRef.current = data.matchId;
      seedRngRef.current = mulberry32(data.seed);
      setMatchedLobby(data.lobby);
      setMyLobby(null);
      clearLobbyCountdown();
      startCountdown();
    });
    s.on('sliceduel_opponent_score', (data: { score: number }) => {
      setOpponentScore(data.score);
    });
    s.on('sliceduel_result', (data: {
      winnerWallet: string;
      yourScore: number;
      opponentScore: number;
      payoutLamports: number;
      claimId?: string;
    }) => {
      endGame(data);
    });
    s.on('sliceduel_lobby_expired', () => {
      clearLobbyCountdown();
      setMyLobby(null);
      setBetError('Lobby expired — no one joined in 5 minutes. SOL refunded.');
    });

    s.emit('get_state');
    if (wallet) {
      s.emit('get_unclaimed_wins', { wallet });
      s.emit('sliceduel_get_lobbies');
    }

    setSocket(s);
    return () => { s.disconnect(); };
  }, [wallet]);

  // Refresh display name from localStorage
  useEffect(() => {
    if (wallet) {
      const stored = localStorage.getItem(`username_${wallet}`);
      if (stored) setDisplayName(stored);
    }
  }, [wallet]);

  // ── Lobby countdown ───────────────────────────────────────────────────────
  const clearLobbyCountdown = useCallback(() => {
    if (lobbyCountdownRef.current) {
      clearInterval(lobbyCountdownRef.current);
      lobbyCountdownRef.current = null;
    }
  }, []);

  const startLobbyCountdown = useCallback(() => {
    setLobbyCountdown(300);
    clearLobbyCountdown();
    let secs = 300;
    lobbyCountdownRef.current = setInterval(() => {
      secs--;
      setLobbyCountdown(secs);
      if (secs <= 0) clearLobbyCountdown();
    }, 1000);
  }, [clearLobbyCountdown]);

  // ── Create lobby (send bet tx) ────────────────────────────────────────────
  const handleCreateLobby = async () => {
    if (!wallet || !publicKey || !socket) return;
    setBetError('');
    if (!HOUSE_WALLET) { setBetError('House wallet not configured.'); return; }
    const sol = parseFloat(wagerInput);
    if (isNaN(sol) || sol < 0.01) { setBetError('Minimum wager is 0.01 SOL'); return; }
    setBetLoading(true);
    try {
      const lamports = Math.floor(sol * LAMPORTS_PER_SOL);
      const balance = await connection.getBalance(publicKey);
      if (lamports + 5000 > balance) { setBetError('Insufficient balance.'); setBetLoading(false); return; }
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction().add(SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(HOUSE_WALLET),
        lamports,
      }));
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const sig = await sendTransaction(tx, connection, { skipPreflight: false, preflightCommitment: 'confirmed' });
      setBetError('⏳ Confirming...');
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: false });
        const conf = status?.value?.confirmationStatus;
        if (status?.value?.err) { setBetError('Transaction failed on-chain.'); setBetLoading(false); return; }
        if (conf === 'confirmed' || conf === 'finalized') { confirmed = true; break; }
        const slot = await connection.getSlot();
        if (slot > lastValidBlockHeight) { setBetError('Transaction expired.'); setBetLoading(false); return; }
      }
      if (!confirmed) { setBetError('Timed out — try again.'); setBetLoading(false); return; }
      setBetError('');
      betTxSigRef.current = sig;
      wagerLamportsRef.current = lamports;
      socket.emit('sliceduel_create_lobby', {
        wallet,
        displayName: displayName || wallet.slice(0, 8),
        wagerLamports: lamports,
        txSignature: sig,
      });
    } catch (e: any) {
      setBetError(e.message?.includes('rejected') ? 'Cancelled.' : e.message || 'Failed.');
    }
    setBetLoading(false);
  };

  // ── Join lobby ────────────────────────────────────────────────────────────
  const handleJoinLobby = async (lobby: Lobby) => {
    if (!wallet || !publicKey || !socket) return;
    setJoinLoading(lobby.id);
    setBetError('');
    try {
      const lamports = lobby.wagerLamports;
      const balance = await connection.getBalance(publicKey);
      if (lamports + 5000 > balance) { setBetError('Insufficient balance.'); setJoinLoading(null); return; }
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const tx = new Transaction().add(SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(HOUSE_WALLET),
        lamports,
      }));
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const sig = await sendTransaction(tx, connection, { skipPreflight: false, preflightCommitment: 'confirmed' });
      setBetError('⏳ Confirming...');
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const status = await connection.getSignatureStatus(sig, { searchTransactionHistory: false });
        const conf = status?.value?.confirmationStatus;
        if (status?.value?.err) { setBetError('Transaction failed.'); setJoinLoading(null); return; }
        if (conf === 'confirmed' || conf === 'finalized') { confirmed = true; break; }
      }
      if (!confirmed) { setBetError('Timed out.'); setJoinLoading(null); return; }
      setBetError('');
      betTxSigRef.current = sig;
      wagerLamportsRef.current = lamports;
      socket.emit('sliceduel_join_lobby', {
        lobbyId: lobby.id,
        wallet,
        displayName: displayName || wallet.slice(0, 8),
        txSignature: sig,
      });
    } catch (e: any) {
      setBetError(e.message?.includes('rejected') ? 'Cancelled.' : e.message || 'Failed.');
    }
    setJoinLoading(null);
  };

  // ── Countdown to game start ───────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    setPhase('countdown');
    setCountdown(3);
    let c = 3;
    const interval = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(interval);
        startGame();
      }
    }, 1000);
  }, []);

  // ── Game loop ─────────────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    scoreRef.current = 0;
    comboRef.current = 0;
    fruitsRef.current = [];
    setScore(0);
    setOpponentScore(0);
    setFruits([]);
    setCombo(0);
    setTimeLeft(GAME_DURATION);
    setPhase('playing');

    // Spawn fruits on a timer driven by the seeded RNG
    spawnTimerRef.current = setInterval(() => {
      const rng = seedRngRef.current;
      if (!rng) return;
      const count = Math.random() < 0.3 ? 2 : 1;
      const newFruits: FruitItem[] = [];
      for (let i = 0; i < count; i++) {
        const isBomb = rng() < 0.08;
        const fruitIdx = isBomb ? -1 : Math.floor(rng() * FRUITS.length);
        const baseSize = isBomb ? 34 : 28 + Math.floor(rng() * 18);
        newFruits.push({
          id: nextIdRef.current++,
          x: 10 + rng() * 80,
          y: 105,
          vx: (rng() - 0.5) * 2.5,
          vy: -(8 + rng() * 6),
          size: baseSize,
          fruitIdx,
          sliced: false,
          opacity: 1,
        });
      }
      fruitsRef.current = [...fruitsRef.current, ...newFruits];
      setFruits([...fruitsRef.current]);
    }, 600);

    // Physics loop
    const animate = () => {
      fruitsRef.current = fruitsRef.current
        .map(f => {
          if (f.sliced) return { ...f, opacity: Math.max(0, f.opacity - 0.08) };
          return {
            ...f,
            x: f.x + f.vx * 0.6,
            y: f.y + f.vy * 0.6,
            vy: f.vy + 0.25,
          };
        })
        .filter(f => !(f.y > 115 && !f.sliced) && !(f.sliced && f.opacity <= 0));
      setFruits([...fruitsRef.current]);
      gameLoopRef.current = requestAnimationFrame(animate);
    };
    gameLoopRef.current = requestAnimationFrame(animate);

    // Game timer
    let t = GAME_DURATION;
    gameTimerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      // Report score to server every 5 seconds
      if (t % 5 === 0 && socket && wallet) {
        socket.emit('sliceduel_score_update', { matchId: matchIdRef.current, wallet, score: scoreRef.current });
      }
      if (t <= 0) {
        clearInterval(gameTimerRef.current!);
        stopGame();
      }
    }, 1000);
  }, [socket, wallet]);

  const stopGame = useCallback(() => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (socket && wallet) {
      socket.emit('sliceduel_game_end', { matchId: matchIdRef.current, wallet, score: scoreRef.current });
    }
  }, [socket, wallet]);

  const endGame = useCallback((data: { winnerWallet: string; yourScore: number; opponentScore: number; payoutLamports: number }) => {
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    const won = data.winnerWallet === wallet;
    setPlayerWon(won);
    setFinalScore(data.yourScore);
    setFinalOpponentScore(data.opponentScore);
    setPayoutAmount(data.payoutLamports);
    setPhase('result');
  }, [wallet]);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current);
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      clearLobbyCountdown();
    };
  }, [clearLobbyCountdown]);

  // ── Slice detection ───────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'playing') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;

    setSliceTrail(prev => [...prev.slice(-8), { x: mx, y: my }]);

    if (!isMouseDownRef.current) return;
    const last = lastMouseRef.current;
    if (!last) { lastMouseRef.current = { x: mx, y: my }; return; }

    // Check each fruit for collision with slice line
    let hitAny = false;
    fruitsRef.current = fruitsRef.current.map(f => {
      if (f.sliced) return f;
      const dx = f.x - mx;
      const dy = f.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < f.size * 0.7) {
        hitAny = true;
        if (f.fruitIdx === -1) {
          // bomb
          scoreRef.current = Math.max(0, scoreRef.current - 5);
          setScore(scoreRef.current);
          comboRef.current = 0;
          setCombo(0);
        } else {
          const pts = FRUITS[f.fruitIdx].points;
          const multiplier = comboRef.current >= 3 ? 2 : 1;
          scoreRef.current += pts * multiplier;
          setScore(scoreRef.current);
          comboRef.current++;
          setCombo(comboRef.current);
          if (comboRef.current >= 3) {
            setComboDisplay({ val: comboRef.current, ts: Date.now() });
          }
          if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
          comboTimerRef.current = setTimeout(() => {
            comboRef.current = 0;
            setCombo(0);
          }, 2000);
        }
        return { ...f, sliced: true };
      }
      return f;
    });
    setFruits([...fruitsRef.current]);
    lastMouseRef.current = { x: mx, y: my };
  }, [phase]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (phase !== 'playing') return;
    isMouseDownRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    lastMouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, [phase]);

  const handleMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    lastMouseRef.current = null;
    setSliceTrail([]);
  }, []);

  // Touch events
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (phase !== 'playing') return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((touch.clientX - rect.left) / rect.width) * 100;
    const my = ((touch.clientY - rect.top) / rect.height) * 100;
    isMouseDownRef.current = true;
    const synth = { clientX: touch.clientX, clientY: touch.clientY, currentTarget: e.currentTarget } as any;
    handleMouseMove({ ...synth, currentTarget: e.currentTarget });
  }, [phase, handleMouseMove]);

  const handleTouchEnd = useCallback(() => {
    isMouseDownRef.current = false;
    lastMouseRef.current = null;
    setSliceTrail([]);
  }, []);

  // ── Claim payout ──────────────────────────────────────────────────────────
  const handleClaim = () => {
    if (!socket || !wallet || claimState === 'claiming') return;
    setClaimState('claiming');
    socket.emit('sliceduel_claim_payout', { matchId: matchIdRef.current, wallet });
    socket.once('sliceduel_claim_result', (res: { success: boolean; tx?: string; error?: string }) => {
      if (res.success) {
        setClaimState('success');
        setClaimTx(res.tx || '');
      } else {
        setClaimState('error');
        setClaimError(res.error || 'Claim failed.');
      }
    });
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetToLobby = () => {
    setPhase('lobby');
    setMyLobby(null);
    setMatchedLobby(null);
    setScore(0);
    setOpponentScore(0);
    setFruits([]);
    setCombo(0);
    setSliceTrail([]);
    setClaimState('idle');
    setClaimTx('');
    setClaimError('');
    matchIdRef.current = null;
    betTxSigRef.current = null;
    if (socket && wallet) socket.emit('sliceduel_get_lobbies');
  };

  // ── Format time ───────────────────────────────────────────────────────────
  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const fmtSol = (l: number) => (l / LAMPORTS_PER_SOL).toFixed(3);

  const activeLobbyWager = matchedLobby?.wagerLamports || 0;
  const potSol = activeLobbyWager > 0 ? fmtSol(activeLobbyWager * 2) : '0.000';
  const payoutSol = activeLobbyWager > 0 ? fmtSol(Math.floor(activeLobbyWager * 2 * (1 - HOUSE_FEE))) : '0.000';

  return (
    <>
      <Head>
        <title>Slice Duel — FruitBowl.fun</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

        {/* ── HEADER ── */}
        <header style={{
          display: 'flex', alignItems: 'center', height: '58px', flexShrink: 0,
          background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)',
          padding: '0 20px', gap: '16px',
        }}>
          <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer' }}>
            <span style={{ fontSize: '26px', lineHeight: 1 }}>🍓</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: '#e53e3e', letterSpacing: '-0.01em' }}>
              FruitBowl<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>.fun</span>
            </span>
          </div>

          <nav style={{ display: 'flex', alignItems: 'center', height: '100%', marginLeft: '8px' }}>
            {[
              { label: '🍊 Orangepot', path: '/' },
              { label: '🍉 FruitRoll', path: '/fruitroll' },
              { label: '🔪 Slice Duel', path: '/sliceduel', active: true },
              { label: '🔗 Referrals', path: '/referral' },
            ].map(item => (
              <div
                key={item.path}
                onClick={() => router.push(item.path)}
                style={{
                  height: '100%', display: 'flex', alignItems: 'center', padding: '0 16px',
                  borderBottom: item.active ? '2px solid #e53e3e' : '2px solid transparent',
                  color: item.active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer', letterSpacing: '0.01em', transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { if (!item.active) { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; } }}
                onMouseLeave={e => { if (!item.active) { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; } }}
              >{item.label}</div>
            ))}
          </nav>

          <div style={{ flex: 1 }} />
          {wallet && (
            <button onClick={() => setShowSettings(true)} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
              borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer',
              width: '34px', height: '34px', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>⚙️</button>
          )}
          <WalletMultiButton />
        </header>

        {/* Unclaimed banner */}
        {wallet && unclaimedTotal > 0 && (
          <div onClick={() => setShowSettings(true)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: 'linear-gradient(90deg,rgba(16,185,129,0.15),rgba(16,185,129,0.08),rgba(16,185,129,0.15))',
            borderBottom: '1px solid rgba(16,185,129,0.35)', padding: '9px 20px', cursor: 'pointer', flexShrink: 0,
          }}>
            <span style={{ fontSize: '16px' }}>💰</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', color: '#10b981' }}>
              You have <strong>{fmtSol(unclaimedTotal)} SOL</strong> in unclaimed winnings
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(16,185,129,0.7)', fontFamily: 'var(--font-display)', fontWeight: 600, textDecoration: 'underline' }}>
              Claim in Settings →
            </span>
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT PANEL ── */}
          <div style={{
            width: '280px', flexShrink: 0, borderRight: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column',
            overflowY: 'auto', padding: '20px 16px', gap: '14px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '4px' }}>🔪</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', color: 'var(--text-primary)' }}>Slice Duel</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>1v1 · Same fruits · Top score wins</div>
            </div>

            {/* Wager input */}
            {phase === 'lobby' && !myLobby && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '10px' }}>
                  SET WAGER
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0 14px', height: '46px', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔪</span>
                  <input
                    type="number" value={wagerInput} onChange={e => setWagerInput(e.target.value)}
                    min="0.01" step="0.01" placeholder="0.1"
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px', outline: 'none', padding: 0 }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}>SOL</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  {QUICK_AMOUNTS.map(v => (
                    <button key={v} onClick={() => setWagerInput(v)} style={{
                      flex: 1, padding: '5px 0', borderRadius: '6px',
                      border: wagerInput === v ? '1px solid rgba(229,62,62,0.5)' : '1px solid var(--border-color)',
                      background: wagerInput === v ? 'rgba(229,62,62,0.12)' : 'rgba(255,255,255,0.03)',
                      color: wagerInput === v ? '#fc8181' : 'var(--text-muted)',
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '11px', cursor: 'pointer',
                    }}>{v}</button>
                  ))}
                </div>

                {wagerInput && parseFloat(wagerInput) >= 0.01 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '10px', lineHeight: 1.6 }}>
                    Pot: <span style={{ color: 'var(--orange-soft)', fontWeight: 700 }}>◎ {(parseFloat(wagerInput) * 2).toFixed(3)}</span>
                    {' · '}Win: <span style={{ color: '#48bb78', fontWeight: 700 }}>◎ {(parseFloat(wagerInput) * 2 * (1 - HOUSE_FEE)).toFixed(3)}</span>
                  </div>
                )}

                {isGameLocked && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', fontSize: '11px', color: '#f87171', fontFamily: 'var(--font-display)', fontWeight: 700, textAlign: 'center', marginBottom: '8px' }}>
                    🔒 GAME LOCKED BY MODERATOR
                  </div>
                )}

                {!wallet ? (
                  <WalletMultiButton style={{ width: '100%', height: '48px', borderRadius: '10px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 700 }} />
                ) : (
                  <button
                    onClick={handleCreateLobby}
                    disabled={betLoading || isGameLocked || !wagerInput}
                    style={{
                      width: '100%', height: '48px', borderRadius: '10px', border: 'none',
                      background: (betLoading || !wagerInput) ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#c53030,#e53e3e)',
                      color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px',
                      cursor: (betLoading || !wagerInput || isGameLocked) ? 'not-allowed' : 'pointer',
                      opacity: (!wagerInput || isGameLocked) ? 0.5 : 1,
                      letterSpacing: '0.05em', transition: 'all 0.2s',
                      boxShadow: wagerInput ? '0 4px 20px rgba(229,62,62,0.4)' : 'none',
                    }}
                  >
                    {betLoading ? '⏳ Confirming...' : '🔪 Create Lobby'}
                  </button>
                )}

                {betError && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', fontSize: '11px', color: '#f87171' }}>
                    {betError}
                  </div>
                )}
              </div>
            )}

            {/* Waiting for opponent */}
            {phase === 'lobby' && myLobby && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: '14px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px' }}>Lobby Open</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px' }}>Waiting for an opponent to match your wager…</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Wager</span>
                  <span style={{ color: 'var(--orange-soft)', fontWeight: 700 }}>◎ {fmtSol(myLobby.wagerLamports)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Expires in</span>
                  <span style={{ color: lobbyCountdown < 60 ? '#f87171' : 'var(--text-secondary)', fontWeight: 700 }}>{fmtTime(lobbyCountdown)}</span>
                </div>
                <button
                  onClick={() => { socket?.emit('sliceduel_cancel_lobby', { lobbyId: myLobby.id, wallet }); setMyLobby(null); clearLobbyCountdown(); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel & Refund
                </button>
              </div>
            )}

            {/* In-game stats */}
            {(phase === 'playing' || phase === 'countdown') && matchedLobby && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>MATCH</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '11px', color: timeLeft <= 10 ? '#f87171' : 'var(--orange-soft)', fontWeight: 700 }}>{fmtTime(timeLeft)}</span>
                </div>
                {/* Score comparison */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                  <div style={{ flex: 1, background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.25)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>YOU</div>
                    <div style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fc8181' }}>{score}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}>VS</div>
                  <div style={{ flex: 1, background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '4px' }}>
                      {matchedLobby.creatorWallet === wallet ? matchedLobby.opponentName || 'Opponent' : matchedLobby.creatorName}
                    </div>
                    <div style={{ fontSize: '26px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#48bb78' }}>{opponentScore}</div>
                  </div>
                </div>
                {combo >= 2 && (
                  <div style={{ textAlign: 'center', padding: '6px', background: 'rgba(255,140,0,0.12)', border: '1px solid rgba(255,140,0,0.3)', borderRadius: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '13px', color: 'var(--orange-bright)' }}>
                      🔥 {combo}× COMBO{combo >= 3 ? ' · 2× POINTS!' : ''}
                    </span>
                  </div>
                )}
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Pot: <span style={{ color: 'var(--orange-soft)', fontWeight: 700 }}>◎ {potSol}</span>
                  {' · '}Win: <span style={{ color: '#48bb78', fontWeight: 700 }}>◎ {payoutSol}</span>
                </div>
              </div>
            )}

            {/* How it works */}
            {phase === 'lobby' && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '14px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '10px' }}>HOW IT WORKS</div>
                {[
                  ['🔪', 'Wager SOL — opponent matches it'],
                  ['🌱', 'Same fruit seed — identical patterns'],
                  ['⚡', 'Slice fruit fast — avoid bombs 💣'],
                  ['🔥', 'Chain slices for 2× combo bonus'],
                  ['🏆', 'Higher score wins 95% of the pot'],
                ].map(([icon, text]) => (
                  <div key={text as string} style={{ display: 'flex', gap: '8px', marginBottom: '7px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '12px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{text}</span>
                  </div>
                ))}
                <div style={{ marginTop: '8px', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                  FruitBowl.fun · 5% house edge
                </div>
              </div>
            )}
          </div>

          {/* ── CENTER: Game area ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

            {/* Countdown overlay */}
            {phase === 'countdown' && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '120px', color: '#e53e3e', filter: 'drop-shadow(0 0 30px rgba(229,62,62,0.8))', lineHeight: 1, textAlign: 'center' }}>
                    {countdown > 0 ? countdown : 'GO!'}
                  </div>
                  {matchedLobby && (
                    <div style={{ textAlign: 'center', marginTop: '16px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      vs {matchedLobby.creatorWallet === wallet ? matchedLobby.opponentName : matchedLobby.creatorName} · ◎ {potSol} pot
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Result overlay */}
            {phase === 'result' && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}>
                <div style={{
                  textAlign: 'center',
                  background: 'linear-gradient(145deg,#0d0520,#13082a)',
                  border: `2px solid ${playerWon ? '#48bb78' : '#ef4444'}`,
                  borderRadius: '24px', padding: '48px 56px',
                  boxShadow: `0 0 80px ${playerWon ? 'rgba(72,187,120,0.4)' : 'rgba(239,68,68,0.3)'}`,
                  minWidth: '360px',
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '8px' }}>{playerWon ? '🏆' : '😔'}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px', color: playerWon ? '#48bb78' : '#f87171', marginBottom: '8px' }}>
                    {playerWon ? '🎉 YOU WIN!' : 'Better Luck!'}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '16px' }}>
                    <div style={{ background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.25)', borderRadius: '10px', padding: '10px 20px' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em' }}>YOUR SCORE</div>
                      <div style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#fc8181' }}>{finalScore}</div>
                    </div>
                    <div style={{ background: 'rgba(72,187,120,0.1)', border: '1px solid rgba(72,187,120,0.2)', borderRadius: '10px', padding: '10px 20px' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.08em' }}>OPPONENT</div>
                      <div style={{ fontSize: '28px', fontFamily: 'var(--font-display)', fontWeight: 800, color: '#48bb78' }}>{finalOpponentScore}</div>
                    </div>
                  </div>

                  {playerWon && payoutAmount > 0 && (
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '36px', color: '#48bb78', textShadow: '0 0 24px rgba(72,187,120,0.5)', marginBottom: '16px' }}>
                      +{fmtSol(payoutAmount)} ◎
                    </div>
                  )}

                  {/* Claim */}
                  {playerWon && payoutAmount > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      {claimState === 'success' ? (
                        <div style={{ padding: '12px', background: 'rgba(72,187,120,0.12)', border: '1px solid rgba(72,187,120,0.4)', borderRadius: '12px' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '14px', color: '#48bb78', marginBottom: '4px' }}>✅ Prize Sent!</div>
                          {claimTx && (
                            <a href={`https://explorer.solana.com/tx/${claimTx}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#48bb78', textDecoration: 'underline', fontFamily: 'Space Mono, monospace' }}>View on Explorer ↗</a>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={handleClaim}
                          disabled={claimState === 'claiming'}
                          style={{
                            display: 'block', width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                            background: claimState === 'claiming' ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#48bb78,#38a169)',
                            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px',
                            cursor: claimState === 'claiming' ? 'not-allowed' : 'pointer',
                            boxShadow: claimState !== 'claiming' ? '0 0 28px rgba(72,187,120,0.4)' : 'none',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {claimState === 'claiming' ? '⏳ Sending...' : `💰 Claim ${fmtSol(payoutAmount)} SOL`}
                        </button>
                      )}
                      {claimState === 'error' && (
                        <div style={{ marginTop: '6px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', fontSize: '11px', color: '#f87171' }}>{claimError}</div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={resetToLobby}
                    style={{ padding: '14px 40px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#c53030,#e53e3e)', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '15px', cursor: 'pointer', letterSpacing: '0.05em' }}
                  >🔄 Play Again</button>
                </div>
              </div>
            )}

            {/* Lobby browser */}
            {phase === 'lobby' && !myLobby && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>OPEN LOBBIES</span>
                    <span style={{ padding: '1px 8px', background: 'rgba(229,62,62,0.15)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: '20px', color: '#fc8181', fontSize: '10px' }}>{openLobbies.length}</span>
                  </div>

                  {openLobbies.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                      <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔪</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '6px' }}>No open lobbies</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Create one and wait for an opponent, or refresh.</div>
                    </div>
                  ) : openLobbies.map(lobby => (
                    <div key={lobby.id} style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                      borderRadius: '14px', padding: '16px', marginBottom: '10px',
                      display: 'flex', alignItems: 'center', gap: '16px',
                    }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(229,62,62,0.3),rgba(229,62,62,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>🔪</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>{lobby.creatorName}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Space Mono, monospace' }}>{lobby.creatorWallet.slice(0, 8)}…</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: 'var(--orange-bright)', marginBottom: '2px' }}>◎ {fmtSol(lobby.wagerLamports)}</div>
                        <div style={{ fontSize: '10px', color: '#48bb78' }}>Win ◎ {fmtSol(Math.floor(lobby.wagerLamports * 2 * (1 - HOUSE_FEE)))}</div>
                      </div>
                      {!wallet ? (
                        <WalletMultiButton style={{ height: '40px', borderRadius: '8px', fontSize: '12px', padding: '0 12px', flexShrink: 0 }} />
                      ) : (
                        <button
                          onClick={() => handleJoinLobby(lobby)}
                          disabled={joinLoading === lobby.id}
                          style={{
                            padding: '10px 20px', borderRadius: '10px', border: 'none',
                            background: joinLoading === lobby.id ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#c53030,#e53e3e)',
                            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '13px',
                            cursor: joinLoading === lobby.id ? 'not-allowed' : 'pointer',
                            flexShrink: 0, letterSpacing: '0.04em',
                            boxShadow: joinLoading !== lobby.id ? '0 3px 14px rgba(229,62,62,0.35)' : 'none',
                          }}
                        >
                          {joinLoading === lobby.id ? '⏳' : '⚔️ Match It'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Waiting for match */}
            {phase === 'lobby' && myLobby && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin-jackpot 3s linear infinite', display: 'inline-block' }}>🔪</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>Lobby Live</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Waiting for someone to match your ◎ {fmtSol(myLobby.wagerLamports)} wager…</div>
                </div>
              </div>
            )}

            {/* Game canvas area */}
            {(phase === 'playing' || phase === 'countdown') && (
              <div
                style={{
                  flex: 1, position: 'relative', overflow: 'hidden',
                  background: 'radial-gradient(ellipse at center, #100a05 0%, #0a0500 100%)',
                  cursor: phase === 'playing' ? 'crosshair' : 'default',
                  userSelect: 'none',
                }}
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Time bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.08)', zIndex: 5 }}>
                  <div style={{
                    height: '100%',
                    width: `${(timeLeft / GAME_DURATION) * 100}%`,
                    background: timeLeft > 20 ? 'linear-gradient(90deg,#e53e3e,#ff8c00)' : '#f87171',
                    transition: 'width 1s linear, background 0.3s',
                  }} />
                </div>

                {/* Score HUD */}
                <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 5 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px', color: '#fc8181', lineHeight: 1, textShadow: '0 0 20px rgba(252,129,129,0.5)' }}>{score}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', fontWeight: 700 }}>YOUR SCORE</div>
                </div>
                <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 5, textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px', color: '#48bb78', lineHeight: 1, textShadow: '0 0 20px rgba(72,187,120,0.5)' }}>{opponentScore}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontFamily: 'var(--font-display)', fontWeight: 700 }}>OPPONENT</div>
                </div>

                {/* Timer center */}
                <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 5, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: '18px', color: timeLeft <= 10 ? '#f87171' : 'var(--text-secondary)' }}>{fmtTime(timeLeft)}</div>
                </div>

                {/* Combo display */}
                {combo >= 3 && (
                  <div style={{ position: 'absolute', top: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 6, textAlign: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: 'var(--orange-bright)', textShadow: '0 0 16px rgba(255,140,0,0.8)', animation: 'winner-flash 0.5s infinite' }}>
                      🔥 {combo}× COMBO · 2× POINTS!
                    </div>
                  </div>
                )}

                {/* Slice trail */}
                {sliceTrail.length > 1 && (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }}>
                    <polyline
                      points={sliceTrail.map(p => `${p.x}% ${p.y}%`).join(' ')}
                      fill="none"
                      stroke="rgba(255,220,100,0.7)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}

                {/* Fruits */}
                {fruits.map(f => (
                  <div
                    key={f.id}
                    style={{
                      position: 'absolute',
                      left: `${f.x}%`,
                      top: `${f.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${f.size}px`,
                      lineHeight: 1,
                      opacity: f.opacity,
                      pointerEvents: 'none',
                      transition: f.sliced ? 'none' : undefined,
                      filter: f.sliced
                        ? 'brightness(2) saturate(3)'
                        : f.fruitIdx >= 0
                        ? `drop-shadow(0 0 4px ${FRUITS[f.fruitIdx].color}99)`
                        : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                      zIndex: 3,
                    }}
                  >
                    {f.fruitIdx === -1 ? BOMB_EMOJI : FRUITS[f.fruitIdx].emoji}
                  </div>
                ))}

                {/* Instruction hint when playing */}
                {phase === 'playing' && fruits.length === 0 && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
                      Hold & drag to slice
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL: Fruit scoring guide ── */}
          <div style={{
            width: '200px', flexShrink: 0, borderLeft: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', overflowY: 'auto',
          }}>
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>FRUIT POINTS</div>
            </div>
            <div style={{ padding: '10px', flex: 1 }}>
              {FRUITS.map(f => (
                <div key={f.name} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', marginBottom: '6px',
                  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontSize: '20px' }}>{f.emoji}</span>
                  <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>{f.name}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '13px', color: f.color }}>+{f.points}</span>
                </div>
              ))}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', marginBottom: '6px',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '8px',
              }}>
                <span style={{ fontSize: '20px' }}>{BOMB_EMOJI}</span>
                <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>Bomb</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '13px', color: '#f87171' }}>−5</span>
              </div>
              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '6px' }}>COMBO BONUS</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Slice 3+ fruits without missing or hitting a bomb for <span style={{ color: 'var(--orange-soft)', fontWeight: 700 }}>2× points</span> per fruit.
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-color)', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
              FruitBowl.fun · 5% house edge · Solana
            </div>
          </div>
        </div>
      </div>

      {showSettings && wallet && (
        <SettingsModal
          wallet={wallet}
          currentDisplayName={displayName}
          socket={socket}
          onClose={() => setShowSettings(false)}
          onUsernameChanged={(name) => { setDisplayName(name); setShowSettings(false); }}
        />
      )}

      <style>{`
        @keyframes winner-flash {
          0%,100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </>
  );
}
