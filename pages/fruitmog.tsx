import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

interface FruitFeatures {
  jawline: 'sharp' | 'soft' | 'chiseled' | 'weak';
  eyes: 'hunter' | 'prey' | 'almond' | 'deep-set';
  brow: 'thick' | 'thin' | 'arched' | 'heavy';
  cheekbones: 'high' | 'flat' | 'prominent';
  chin: 'strong' | 'receding' | 'dimpled' | 'pointed';
  ratio: number;
}

interface FruitCharacter {
  id: string;
  emoji: string;
  name: string;
  color: string;
  glow: string;
  features: FruitFeatures;
  catchphrase: string;
  tier: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C';
}

const ALL_FRUITS: FruitCharacter[] = [
  {
    id: 'orange-chad',
    emoji: '🍊',
    name: 'The Orange',
    color: '#ff8c00',
    glow: 'rgba(255,140,0,0.4)',
    features: { jawline: 'chiseled', eyes: 'hunter', brow: 'heavy', cheekbones: 'prominent', chin: 'dimpled', ratio: 1.618 },
    catchphrase: '"I am the golden ratio."',
    tier: 'SSS',
  },
  {
    id: 'strawberry-sigma',
    emoji: '🍓',
    name: 'The Strawberry',
    color: '#e53e3e',
    glow: 'rgba(229,62,62,0.4)',
    features: { jawline: 'sharp', eyes: 'hunter', brow: 'thick', cheekbones: 'high', chin: 'strong', ratio: 1.55 },
    catchphrase: '"Seeds are just extra texture."',
    tier: 'SS',
  },
  {
    id: 'grape-looksmax',
    emoji: '🍇',
    name: 'The Grape',
    color: '#9f7aea',
    glow: 'rgba(159,122,234,0.4)',
    features: { jawline: 'sharp', eyes: 'deep-set', brow: 'arched', cheekbones: 'prominent', chin: 'strong', ratio: 1.49 },
    catchphrase: '"I travel in clusters. That\'s called social proof."',
    tier: 'SS',
  },
  {
    id: 'watermelon-goat',
    emoji: '🍉',
    name: 'The Watermelon',
    color: '#48bb78',
    glow: 'rgba(72,187,120,0.4)',
    features: { jawline: 'chiseled', eyes: 'almond', brow: 'heavy', cheekbones: 'high', chin: 'dimpled', ratio: 1.51 },
    catchphrase: '"99% water. 1% pure sigma."',
    tier: 'S',
  },
  {
    id: 'banana-npc',
    emoji: '🍌',
    name: 'The Banana',
    color: '#f6e05e',
    glow: 'rgba(246,224,94,0.3)',
    features: { jawline: 'soft', eyes: 'prey', brow: 'thin', cheekbones: 'flat', chin: 'receding', ratio: 1.21 },
    catchphrase: '"I try to fit in by being curvy."',
    tier: 'B',
  },
  {
    id: 'cherry-menace',
    emoji: '🍒',
    name: 'The Cherry',
    color: '#fc8181',
    glow: 'rgba(252,129,129,0.35)',
    features: { jawline: 'sharp', eyes: 'hunter', brow: 'thick', cheekbones: 'high', chin: 'pointed', ratio: 1.58 },
    catchphrase: '"Small but it hits different."',
    tier: 'S',
  },
  {
    id: 'lemon-cope',
    emoji: '🍋',
    name: 'The Lemon',
    color: '#fef08a',
    glow: 'rgba(254,240,138,0.25)',
    features: { jawline: 'weak', eyes: 'prey', brow: 'thin', cheekbones: 'flat', chin: 'receding', ratio: 1.15 },
    catchphrase: '"When life gives you... you know the rest."',
    tier: 'C',
  },
  {
    id: 'pineapple-alpha',
    emoji: '🍍',
    name: 'The Pineapple',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.4)',
    features: { jawline: 'chiseled', eyes: 'deep-set', brow: 'heavy', cheekbones: 'prominent', chin: 'strong', ratio: 1.62 },
    catchphrase: '"Crown on head. Always."',
    tier: 'SS',
  },
  {
    id: 'peach-softmaxx',
    emoji: '🍑',
    name: 'The Peach',
    color: '#fca5a5',
    glow: 'rgba(252,165,165,0.3)',
    features: { jawline: 'soft', eyes: 'almond', brow: 'arched', cheekbones: 'high', chin: 'dimpled', ratio: 1.44 },
    catchphrase: '"Soft aesthetic, hard mindset."',
    tier: 'A',
  },
  {
    id: 'mango-gigachad',
    emoji: '🥭',
    name: 'The Mango',
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.4)',
    features: { jawline: 'chiseled', eyes: 'hunter', brow: 'heavy', cheekbones: 'prominent', chin: 'strong', ratio: 1.71 },
    catchphrase: '"I am the king of fruits. Literally Wikipedia."',
    tier: 'SSS',
  },
  {
    id: 'kiwi-underrated',
    emoji: '🥝',
    name: 'The Kiwi',
    color: '#84cc16',
    glow: 'rgba(132,204,22,0.35)',
    features: { jawline: 'sharp', eyes: 'hunter', brow: 'thick', cheekbones: 'high', chin: 'strong', ratio: 1.53 },
    catchphrase: '"Hairy exterior. Pure green within."',
    tier: 'A',
  },
  {
    id: 'avocado-npc2',
    emoji: '🥑',
    name: 'The Avocado',
    color: '#4d7c0f',
    glow: 'rgba(77,124,15,0.35)',
    features: { jawline: 'soft', eyes: 'prey', brow: 'thin', cheekbones: 'flat', chin: 'receding', ratio: 1.18 },
    catchphrase: '"I peak at brunch."',
    tier: 'B',
  },
];

const FEATURE_LABELS: Record<string, Record<string, string>> = {
  jawline: { sharp: '⚔️ Sharp Jaw', soft: '💆 Soft Jaw', chiseled: '💎 Chiseled Jaw', weak: '😔 Weak Jaw' },
  eyes: { hunter: '🎯 Hunter Eyes', prey: '😳 Prey Eyes', almond: '✨ Almond Eyes', 'deep-set': '👁️ Deep-Set Eyes' },
  brow: { thick: '🦁 Thick Brows', thin: '〰️ Thin Brows', arched: '🌙 Arched Brows', heavy: '🪨 Heavy Brows' },
  cheekbones: { high: '📐 High Cheekbones', flat: '😑 Flat Face', prominent: '🗿 Prominent Cheeks' },
  chin: { strong: '🦷 Strong Chin', receding: '😶 Receding Chin', dimpled: '🌟 Dimpled Chin', pointed: '💡 Pointed Chin' },
};

const TIER_COLORS: Record<string, string> = {
  SSS: '#ff6b00', SS: '#9f7aea', S: '#f6e05e', A: '#48bb78', B: '#60a5fa', C: '#6b7280',
};

const WIN_LINES = [
  'CORRECT. You have eyes.',
  'BASED PICK.',
  'FRUITMOG CONFIRMED.',
  'THE JURY HAS SPOKEN.',
  'OBJECTIVE TRUTH.',
  'LOOKS-CERTIFIED VICTORY.',
  'SIGMA SELECTION.',
  'CANTHAL TILT ACKNOWLEDGED.',
];

const LOSE_LINES = [
  'COPE. SEETHE. MALD.',
  'WRONG FRUIT PICKED.',
  'YOUR FACE BLINDNESS IS SHOWING.',
  'FRUITMOG REVERSED.',
  'LITERALLY HOW.',
  'THE FRUITS ARE JUDGING YOU.',
  'LOW IQ SELECTION.',
  'SEEK LOOKSMAXXING RESOURCES.',
];

function FruitFace({ fruit, size = 180, isWinner, isLoser }: {
  fruit: FruitCharacter;
  size?: number;
  isWinner?: boolean;
  isLoser?: boolean;
}) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.42;

  const isHunter = fruit.features.eyes === 'hunter';
  const isDeepSet = fruit.features.eyes === 'deep-set';
  const isAlmond = fruit.features.eyes === 'almond';
  const browThick = fruit.features.brow === 'heavy' ? 4.5 : fruit.features.brow === 'thick' ? 3.5 : fruit.features.brow === 'arched' ? 2.5 : 2;
  const jawSharp = fruit.features.jawline === 'sharp' || fruit.features.jawline === 'chiseled';
  const jawWeak = fruit.features.jawline === 'weak' || fruit.features.jawline === 'soft';
  const eyeY = isDeepSet ? cy - s * 0.08 : cy - s * 0.06;
  const eyeSpacing = s * 0.155;
  const lx = cx - eyeSpacing;
  const rx = cx + eyeSpacing;
  const eyeTiltL = isHunter ? -4 : isAlmond ? -2 : 0;
  const eyeTiltR = isHunter ? 4 : isAlmond ? 2 : 0;
  const eyeRx = isAlmond ? s * 0.085 : s * 0.075;
  const eyeRy = isHunter ? s * 0.048 : s * 0.055;
  const highCheek = fruit.features.cheekbones === 'high' || fruit.features.cheekbones === 'prominent';
  const chinStrong = fruit.features.chin === 'strong';
  const chinY = cy + r * (chinStrong ? 0.82 : jawWeak ? 0.7 : 0.76);

  return (
    <svg
      width={s} height={s} viewBox={`0 0 ${s} ${s}`}
      style={{
        filter: isWinner
          ? `drop-shadow(0 0 ${s * 0.12}px ${fruit.glow}) drop-shadow(0 0 ${s * 0.06}px ${fruit.color})`
          : isLoser
          ? 'grayscale(60%) brightness(0.6)'
          : `drop-shadow(0 0 ${s * 0.05}px ${fruit.glow})`,
        transition: 'filter 0.4s ease',
      }}
    >
      {isWinner && (
        <circle cx={cx} cy={cy} r={r + s * 0.05} fill="none" stroke={fruit.color} strokeWidth={s * 0.025} opacity={0.4}>
          <animate attributeName="r" values={`${r + s * 0.04};${r + s * 0.08};${r + s * 0.04}`} dur="1.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.2s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={cx} cy={cy} r={r} fill={fruit.color} opacity={0.15} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={fruit.color} strokeWidth={jawSharp ? s * 0.03 : s * 0.02} opacity={0.9} />
      {jawSharp && (
        <>
          <line x1={cx - r * 0.65} y1={cy + r * 0.55} x2={cx - r * 0.45} y2={cy + r * 0.82} stroke={fruit.color} strokeWidth={s * 0.025} strokeLinecap="round" opacity={0.8} />
          <line x1={cx + r * 0.65} y1={cy + r * 0.55} x2={cx + r * 0.45} y2={cy + r * 0.82} stroke={fruit.color} strokeWidth={s * 0.025} strokeLinecap="round" opacity={0.8} />
        </>
      )}
      {highCheek && (
        <>
          <ellipse cx={cx - r * 0.62} cy={cy + r * 0.15} rx={r * 0.22} ry={r * 0.1} fill={fruit.color} opacity={0.22} transform={`rotate(-20,${cx - r * 0.62},${cy + r * 0.15})`} />
          <ellipse cx={cx + r * 0.62} cy={cy + r * 0.15} rx={r * 0.22} ry={r * 0.1} fill={fruit.color} opacity={0.22} transform={`rotate(20,${cx + r * 0.62},${cy + r * 0.15})`} />
        </>
      )}
      <line x1={lx - eyeRx * 1.1} y1={eyeY - eyeRy * 2.2 + (isHunter ? 3 : 0)} x2={lx + eyeRx * 0.8} y2={eyeY - eyeRy * 2.0 + eyeTiltL} stroke={fruit.color} strokeWidth={browThick} strokeLinecap="round" opacity={0.95} />
      <line x1={rx - eyeRx * 0.8} y1={eyeY - eyeRy * 2.0 + eyeTiltR} x2={rx + eyeRx * 1.1} y2={eyeY - eyeRy * 2.2 + (isHunter ? 3 : 0)} stroke={fruit.color} strokeWidth={browThick} strokeLinecap="round" opacity={0.95} />
      <ellipse cx={lx} cy={eyeY} rx={eyeRx} ry={eyeRy} fill={fruit.color} opacity={0.85} transform={isHunter ? `rotate(-8,${lx},${eyeY})` : isAlmond ? `rotate(-5,${lx},${eyeY})` : ''} />
      <ellipse cx={rx} cy={eyeY} rx={eyeRx} ry={eyeRy} fill={fruit.color} opacity={0.85} transform={isHunter ? `rotate(8,${rx},${eyeY})` : isAlmond ? `rotate(5,${rx},${eyeY})` : ''} />
      <circle cx={lx} cy={eyeY} r={eyeRy * 0.6} fill="#0a0500" opacity={0.9} />
      <circle cx={rx} cy={eyeY} r={eyeRy * 0.6} fill="#0a0500" opacity={0.9} />
      <circle cx={lx - eyeRy * 0.2} cy={eyeY - eyeRy * 0.25} r={eyeRy * 0.22} fill="#fff" opacity={0.7} />
      <circle cx={rx - eyeRy * 0.2} cy={eyeY - eyeRy * 0.25} r={eyeRy * 0.22} fill="#fff" opacity={0.7} />
      <ellipse cx={cx} cy={cy + s * 0.04} rx={s * 0.045} ry={s * 0.03} fill={fruit.color} opacity={0.45} />
      {jawSharp ? (
        <path d={`M ${cx - s * 0.08} ${cy + s * 0.18} Q ${cx + s * 0.02} ${cy + s * 0.22} ${cx + s * 0.1} ${cy + s * 0.16}`} fill="none" stroke={fruit.color} strokeWidth={s * 0.022} strokeLinecap="round" opacity={0.9} />
      ) : jawWeak ? (
        <path d={`M ${cx - s * 0.07} ${cy + s * 0.19} Q ${cx} ${cy + s * 0.16} ${cx + s * 0.07} ${cy + s * 0.19}`} fill="none" stroke={fruit.color} strokeWidth={s * 0.02} strokeLinecap="round" opacity={0.65} />
      ) : (
        <path d={`M ${cx - s * 0.07} ${cy + s * 0.18} Q ${cx + s * 0.02} ${cy + s * 0.21} ${cx + s * 0.09} ${cy + s * 0.17}`} fill="none" stroke={fruit.color} strokeWidth={s * 0.02} strokeLinecap="round" opacity={0.85} />
      )}
      {fruit.features.chin === 'dimpled' && (
        <circle cx={cx} cy={chinY} r={s * 0.018} fill="none" stroke={fruit.color} strokeWidth={s * 0.015} opacity={0.5} />
      )}
      <text x={cx} y={cy - r * 0.55} textAnchor="middle" fontSize={s * 0.22} style={{ userSelect: 'none' }}>
        {fruit.emoji}
      </text>
    </svg>
  );
}

function FeaturePill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', borderRadius: '20px',
      background: `${color}18`, border: `1px solid ${color}40`,
      fontSize: '10px', color, fontFamily: 'var(--font-display)',
      fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

function FruitCard({ fruit, side, selected, winner, result, isMobile, faceSize, onClick }: {
  fruit: FruitCharacter;
  side: 'left' | 'right';
  selected: 'left' | 'right' | null;
  winner: 'left' | 'right' | null;
  result: 'win' | 'lose' | null;
  isMobile: boolean;
  faceSize: number;
  onClick: () => void;
}) {
  const isWinner = winner === side;
  const isLoser = winner !== null && winner !== side;
  const isRevealed = result !== null;
  const tierColor = TIER_COLORS[fruit.tier];

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flex: 1, maxWidth: isMobile ? '160px' : '280px',
        cursor: selected ? 'default' : 'pointer',
        padding: isMobile ? '10px 8px' : '16px',
        background: isWinner ? `linear-gradient(180deg, ${fruit.color}18, ${fruit.color}08)` : isLoser ? 'rgba(255,255,255,0.02)' : 'var(--bg-card)',
        border: isWinner ? `2px solid ${fruit.color}` : isLoser ? '1px solid rgba(255,255,255,0.06)' : '1px solid var(--border-color)',
        borderRadius: '20px',
        transition: 'all 0.35s ease',
        transform: isWinner ? 'scale(1.04)' : isLoser ? 'scale(0.96)' : 'scale(1)',
        boxShadow: isWinner ? `0 0 32px ${fruit.glow}` : 'none',
        userSelect: 'none',
      }}
    >
      <div style={{
        alignSelf: 'flex-end', marginBottom: '4px',
        padding: '2px 8px', borderRadius: '6px',
        background: `${tierColor}20`, border: `1px solid ${tierColor}50`,
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: '10px', color: tierColor, letterSpacing: '0.08em',
      }}>
        TIER {fruit.tier}
      </div>

      <div style={{ position: 'relative' }}>
        <FruitFace fruit={fruit} size={faceSize} isWinner={isWinner} isLoser={isLoser} />
        {isWinner && (
          <div style={{ position: 'absolute', top: -10, right: -10, fontSize: isMobile ? '20px' : '28px' }}>👑</div>
        )}
      </div>

      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: isMobile ? '13px' : '16px',
        color: isLoser ? 'var(--text-muted)' : fruit.color,
        marginTop: '8px', letterSpacing: '0.02em', transition: 'color 0.35s',
      }}>
        {fruit.emoji} {fruit.name}
      </div>

      <div style={{
        fontFamily: 'var(--font-body)', fontSize: isMobile ? '9px' : '10px',
        color: isLoser ? 'var(--text-muted)' : 'var(--text-secondary)',
        textAlign: 'center', marginTop: '4px', lineHeight: 1.4,
        opacity: isLoser ? 0.4 : 0.85, transition: 'opacity 0.35s',
        maxWidth: isMobile ? '140px' : '240px',
      }}>
        {fruit.catchphrase}
      </div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center',
        marginTop: '10px', opacity: isLoser ? 0.35 : 1, transition: 'opacity 0.35s',
      }}>
        <FeaturePill label={FEATURE_LABELS.eyes[fruit.features.eyes]} color={fruit.color} />
        <FeaturePill label={FEATURE_LABELS.jawline[fruit.features.jawline]} color={fruit.color} />
        {(!isMobile || isRevealed) && <FeaturePill label={FEATURE_LABELS.cheekbones[fruit.features.cheekbones]} color={fruit.color} />}
      </div>

      {isRevealed && (
        <div style={{
          marginTop: '8px', fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: '11px', color: isWinner ? fruit.color : 'var(--text-muted)',
          letterSpacing: '0.04em',
        }}>
          Φ {fruit.features.ratio.toFixed(3)} facial ratio
        </div>
      )}
    </div>
  );
}

export default function FruitMog() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() || null;

  const [left, setLeft] = useState<FruitCharacter | null>(null);
  const [right, setRight] = useState<FruitCharacter | null>(null);
  const [selected, setSelected] = useState<'left' | 'right' | null>(null);
  const [result, setResult] = useState<'win' | 'lose' | null>(null);
  const [winner, setWinner] = useState<'left' | 'right' | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [resultLine, setResultLine] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('fruitmog_best');
    if (stored) setBestStreak(parseInt(stored, 10));
  }, []);

  function pickNewPair() {
    const shuffled = [...ALL_FRUITS].sort(() => Math.random() - 0.5);
    setLeft(shuffled[0]);
    setRight(shuffled[1]);
    setSelected(null);
    setResult(null);
    setWinner(null);
    setResultLine('');
  }

  useEffect(() => { pickNewPair(); }, []);

  function handlePick(side: 'left' | 'right') {
    if (selected || !left || !right) return;
    setSelected(side);

    setTimeout(() => {
      const actualWinner: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';
      const didWin = side === actualWinner;
      setWinner(actualWinner);
      setResult(didWin ? 'win' : 'lose');
      setTotal(t => t + 1);
      if (didWin) {
        setScore(s => s + 1);
        const newStreak = streak + 1;
        setStreak(newStreak);
        if (newStreak > bestStreak) {
          setBestStreak(newStreak);
          localStorage.setItem('fruitmog_best', String(newStreak));
        }
        setResultLine(WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)]);
      } else {
        setStreak(0);
        setResultLine(LOSE_LINES[Math.floor(Math.random() * LOSE_LINES.length)]);
      }
    }, 500);
  }

  const winFruit = winner === 'left' ? left : right;
  const faceSize = isMobile ? 120 : 160;

  return (
    <>
      <Head>
        <title>FruitMog — FruitBowl.fun</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>

      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', height: '58px', flexShrink: 0, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', padding: '0 20px', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ fontSize: '26px', lineHeight: 1 }}>🍓</span>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '18px', color: '#e53e3e', letterSpacing: '-0.01em' }}>
              FruitBowl<span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>.fun</span>
            </span>
          </div>
          {!isMobile && (
            <nav style={{ display: 'flex', alignItems: 'center', height: '100%', marginLeft: '8px' }}>
              {[
                { label: '🍊 Orangepot', path: '/' },
                { label: '🍉 FruitRoll', path: '/fruitroll' },
                { label: '🥊 FruitMog', path: '/fruitmog', active: true },
                { label: '🔗 Referrals', path: '/referral' },
              ].map(item => (
                <div key={item.path} onClick={() => router.push(item.path)} style={{ height: '100%', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: (item as any).active ? '2px solid var(--orange-bright)' : '2px solid transparent', color: (item as any).active ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', letterSpacing: '0.01em', transition: 'color 0.15s' }}>
                  {item.label}
                </div>
              ))}
            </nav>
          )}
          <div style={{ flex: 1 }} />
          <WalletMultiButton style={{ height: '36px', borderRadius: '8px', fontSize: '12px', background: 'linear-gradient(135deg,#cc5500,#ff8c00)', fontFamily: 'var(--font-display)', fontWeight: 700 }} />
        </header>

        {/* Scorebar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '16px' : '32px', padding: '10px 20px', flexShrink: 0, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          {[
            { label: 'CORRECT', value: score, color: 'var(--win-green)' },
            { label: 'STREAK', value: streak, color: streak >= 3 ? '#f6e05e' : 'var(--orange-soft)' },
            { label: 'BEST', value: bestStreak, color: 'var(--orange-bright)' },
            { label: 'TOTAL', value: total, color: 'var(--text-secondary)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: isMobile ? '18px' : '22px', color, lineHeight: 1 }}>{value}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Arena */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: isMobile ? '12px 8px' : '20px' }}>

          {/* Prompt */}
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '10px' : '16px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: isMobile ? '15px' : '20px', color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            {result === null
              ? <>WHO <span style={{ color: 'var(--orange-bright)' }}>FRUITMOGS</span> WHO?</>
              : result === 'win'
              ? <span style={{ color: 'var(--win-green)' }}>✅ {resultLine}</span>
              : <span style={{ color: '#ef4444' }}>❌ {resultLine}</span>
            }
          </div>

          {/* Cards */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '8px' : '24px', width: '100%', flex: 1, maxHeight: isMobile ? '420px' : '500px' }}>
            {left && <FruitCard fruit={left} side="left" selected={selected} winner={winner} result={result} isMobile={isMobile} faceSize={faceSize} onClick={() => handlePick('left')} />}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: isMobile ? '24px' : '36px', color: result === null ? 'var(--orange-bright)' : result === 'win' ? 'var(--win-green)' : '#ef4444', letterSpacing: '-0.02em', transition: 'color 0.3s' }}>VS</div>
              {streak >= 3 && result === null && (
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '10px', color: '#f6e05e', letterSpacing: '0.08em' }}>🔥 {streak}</div>
              )}
            </div>

            {right && <FruitCard fruit={right} side="right" selected={selected} winner={winner} result={result} isMobile={isMobile} faceSize={faceSize} onClick={() => handlePick('right')} />}
          </div>

          {/* Result row */}
          {result !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: isMobile ? '12px' : '20px', flexShrink: 0 }}>
              {winFruit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '20px', background: `${winFruit.color}15`, border: `1px solid ${winFruit.color}40`, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', color: winFruit.color }}>
                  <span>{winFruit.emoji}</span>
                  <span>{winFruit.name} MOGS — Tier {winFruit.tier}</span>
                </div>
              )}
              <button
                onClick={pickNewPair}
                style={{ padding: isMobile ? '12px 36px' : '14px 48px', background: 'linear-gradient(135deg, #cc5500, #ff8c00)', border: 'none', borderRadius: '12px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: isMobile ? '14px' : '16px', color: '#fff', cursor: 'pointer', letterSpacing: '0.06em', boxShadow: '0 0 24px rgba(255,107,0,0.4)' }}
              >
                NEXT MATCHUP →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
