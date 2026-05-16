import React, { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

interface ChatMessage {
  id: string;
  wallet: string;
  displayName: string;
  message: string;
  timestamp: number;
}

interface ChatProps {
  socket: Socket | null;
  currentWallet: string | null;
  currentDisplayName: string;
  isConnected: boolean;
}

const COLORS = [
  '#FF6B35', '#FF9F1C', '#FFBF69', '#FC5C65', '#45AAF2',
  '#26DE81', '#A55EEA', '#FD79A8', '#74B9FF', '#55EFC4',
];

function getColor(wallet: string): string {
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = wallet.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function shortenWallet(wallet: string): string {
  return wallet.slice(0, 4) + '…' + wallet.slice(-4);
}

export default function Chat({ socket, currentWallet, currentDisplayName, isConnected }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat_history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('chat_message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-199), msg]);
    });

    return () => {
      socket.off('chat_history');
      socket.off('chat_message');
    };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!socket || !currentWallet || !input.trim()) return;
    socket.emit('send_chat', {
      wallet: currentWallet,
      displayName: currentDisplayName || shortenWallet(currentWallet),
      message: input.trim(),
    });
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--chat-bg)',
        borderRight: '1px solid var(--border-color)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isConnected ? '#26DE81' : '#FC5C65',
            boxShadow: isConnected ? '0 0 6px #26DE81' : 'none',
          }}
        />
        <span
          style={{
            fontFamily: 'Syne, sans-serif',
            fontWeight: 700,
            fontSize: '14px',
            color: 'var(--text-secondary)',
            letterSpacing: '0.05em',
          }}
        >
          LIVE CHAT
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
          {messages.length} msgs
        </span>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              marginTop: '40px',
            }}
          >
            No messages yet.
            <br />
            Be the first to chat!
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.wallet === currentWallet;
          const color = getColor(msg.wallet);

          return (
            <div
              key={msg.id}
              className="animate-slide-in-up"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                alignItems: isOwn ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color,
                    fontFamily: 'Syne, sans-serif',
                  }}
                >
                  {msg.displayName}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <div
                style={{
                  background: isOwn
                    ? 'rgba(255,107,0,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isOwn ? 'rgba(255,107,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '7px 11px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  maxWidth: '100%',
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                }}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 280))}
          onKeyDown={handleKey}
          placeholder={currentWallet ? 'Say something...' : 'Connect wallet to chat'}
          disabled={!currentWallet || !isConnected}
          style={{
            flex: 1,
            fontSize: '12px',
            padding: '8px 10px',
            borderRadius: '8px',
          }}
          maxLength={280}
        />
        <button
          onClick={sendMessage}
          disabled={!currentWallet || !input.trim() || !isConnected}
          className="btn-orange"
          style={{ padding: '8px 14px', fontSize: '13px', borderRadius: '8px' }}
        >
          →
        </button>
      </div>
    </div>
  );
}
