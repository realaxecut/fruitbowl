import React, { useState, useEffect } from 'react';

interface CountdownProps {
  endsAt: number | null;
  status: string;
}

export default function Countdown({ endsAt, status }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!endsAt) return;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [endsAt]);

  const getStatusInfo = () => {
    switch (status) {
      case 'waiting':
        return {
          label: 'WAITING FOR PLAYERS',
          sublabel: 'Need at least 2 players',
          color: 'var(--text-muted)',
          bg: 'rgba(120,100,60,0.1)',
          border: 'rgba(120,100,60,0.2)',
        };
      case 'active':
        return {
          label: `SPINNING IN ${timeLeft}s`,
          sublabel: 'More players can still join!',
          color: timeLeft <= 10 ? '#FC5C65' : 'var(--orange-bright)',
          bg: timeLeft <= 10 ? 'rgba(252,92,101,0.1)' : 'rgba(255,107,0,0.1)',
          border: timeLeft <= 10 ? 'rgba(252,92,101,0.3)' : 'rgba(255,107,0,0.3)',
        };
      case 'spinning':
        return {
          label: '🍊 SPINNING...',
          sublabel: 'Picking the winner!',
          color: '#FF9F1C',
          bg: 'rgba(255,159,28,0.1)',
          border: 'rgba(255,159,28,0.3)',
        };
      case 'ended':
        return {
          label: 'ROUND ENDED',
          sublabel: 'New round starting...',
          color: '#26DE81',
          bg: 'rgba(38,222,129,0.1)',
          border: 'rgba(38,222,129,0.3)',
        };
      default:
        return { label: '—', sublabel: '', color: 'var(--text-muted)', bg: 'transparent', border: 'transparent' };
    }
  };

  const info = getStatusInfo();

  return (
    <div
      style={{
        background: info.bg,
        border: `1px solid ${info.border}`,
        borderRadius: '10px',
        padding: '14px 20px',
        textAlign: 'center',
        transition: 'all 0.3s',
      }}
    >
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '16px',
          color: info.color,
          letterSpacing: '0.05em',
          marginBottom: '4px',
        }}
      >
        {info.label}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{info.sublabel}</div>

      {status === 'active' && endsAt && (
        <div style={{ marginTop: '10px' }}>
          <div
            style={{
              height: '3px',
              background: 'var(--border-color)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                background: timeLeft <= 10 ? '#FC5C65' : 'var(--orange-bright)',
                width: `${(timeLeft / 30) * 100}%`,
                transition: 'width 0.5s linear, background 0.3s',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
