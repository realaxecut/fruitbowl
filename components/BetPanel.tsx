import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Socket } from 'socket.io-client';

const HOUSE_WALLET = 'YOUR_HOUSE_WALLET_ADDRESS_HERE'; // Replace with your wallet

interface BetPanelProps {
  socket: Socket | null;
  displayName: string;
  roundStatus: string;
  myBet: number;
  isConnected: boolean;
}

const QUICK_BETS = [0.01, 0.05, 0.1, 0.5, 1, 5];

export default function BetPanel({ socket, displayName, roundStatus, myBet, isConnected }: BetPanelProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [betAmount, setBetAmount] = useState('0.1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txSig, setTxSig] = useState('');

  const wallet = publicKey?.toBase58() || null;

  const handleBet = async () => {
    if (!wallet || !publicKey || !socket) return;
    setError('');
    setTxSig('');

    const solAmount = parseFloat(betAmount);
    if (isNaN(solAmount) || solAmount < 0.01) {
      setError('Minimum bet is 0.01 SOL');
      return;
    }

    if (roundStatus === 'spinning' || roundStatus === 'ended') {
      setError('Round is not accepting bets right now');
      return;
    }

    setLoading(true);
    try {
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

      // Create transaction to send SOL to house wallet
      // In production, this would go to a program escrow
      const houseWallet = HOUSE_WALLET !== 'YOUR_HOUSE_WALLET_ADDRESS_HERE'
        ? new PublicKey(HOUSE_WALLET)
        : publicKey; // fallback to self for demo

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: houseWallet,
          lamports,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      setTxSig(signature);

      // Notify game server
      socket.emit('place_bet', {
        wallet,
        displayName: displayName || wallet.slice(0, 8),
        amountLamports: lamports,
      });

    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('rejected')) {
        setError('Transaction cancelled');
      } else {
        setError(e.message || 'Transaction failed');
      }
    }
    setLoading(false);
  };

  const isAcceptingBets = roundStatus === 'waiting' || roundStatus === 'active';
  const myBetSol = (myBet / LAMPORTS_PER_SOL).toFixed(4);

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div
        style={{
          fontFamily: 'Syne, sans-serif',
          fontWeight: 700,
          fontSize: '13px',
          color: 'var(--text-secondary)',
          letterSpacing: '0.05em',
          marginBottom: '16px',
        }}
      >
        ENTER JACKPOT
      </div>

      {!wallet ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Connect your Phantom wallet to play
          </p>
          <WalletMultiButton />
        </div>
      ) : (
        <>
          {myBet > 0 && (
            <div
              style={{
                background: 'rgba(255,107,0,0.08)',
                border: '1px solid rgba(255,107,0,0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '14px',
                fontSize: '12px',
                color: 'var(--orange-soft)',
              }}
            >
              Your current slice: <strong>{myBetSol} SOL</strong>
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                Add more to increase your slice!
              </span>
            </div>
          )}

          {/* Amount input */}
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '6px',
              }}
            >
              AMOUNT (SOL)
            </label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              min="0.01"
              step="0.01"
              style={{ width: '100%', fontSize: '16px', padding: '10px 14px' }}
            />
          </div>

          {/* Quick bet buttons */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              marginBottom: '14px',
            }}
          >
            {QUICK_BETS.map((amt) => (
              <button
                key={amt}
                onClick={() => setBetAmount(String(amt))}
                style={{
                  padding: '6px',
                  fontSize: '11px',
                  background:
                    betAmount === String(amt)
                      ? 'rgba(255,107,0,0.2)'
                      : 'var(--bg-secondary)',
                  border: `1px solid ${
                    betAmount === String(amt)
                      ? 'rgba(255,107,0,0.5)'
                      : 'var(--border-color)'
                  }`,
                  borderRadius: '6px',
                  color: betAmount === String(amt) ? 'var(--orange-soft)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'Space Mono, monospace',
                }}
              >
                {amt}◎
              </button>
            ))}
          </div>

          {/* Place bet button */}
          <button
            onClick={handleBet}
            disabled={loading || !isAcceptingBets || !isConnected}
            className="btn-orange"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              letterSpacing: '0.05em',
              fontFamily: 'Syne, sans-serif',
            }}
          >
            {loading
              ? '⏳ CONFIRMING...'
              : !isAcceptingBets
              ? '🔒 ROUND CLOSED'
              : `🍊 BUY SLICE — ${betAmount || '0'} SOL`}
          </button>

          {/* Error / success */}
          {error && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'rgba(252,92,101,0.1)',
                border: '1px solid rgba(252,92,101,0.3)',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#FC5C65',
              }}
            >
              {error}
            </div>
          )}
          {txSig && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'rgba(38,222,129,0.08)',
                border: '1px solid rgba(38,222,129,0.2)',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#26DE81',
              }}
            >
              ✓ Bet placed!{' '}
              <a
                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#26DE81', textDecoration: 'underline' }}
              >
                View tx
              </a>
            </div>
          )}

          {/* Info */}
          <div
            style={{
              marginTop: '14px',
              fontSize: '10px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            5% house fee on winnings · Min bet 0.01 SOL · Network: Devnet
          </div>
        </>
      )}
    </div>
  );
}
