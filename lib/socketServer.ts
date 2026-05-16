import { Server as HTTPServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import {
  getCurrentRound,
  getOrCreateActiveRound,
  placeBet,
  spinRound,
  endRound,
  addChatMessage,
  getChatHistory,
  getUser,
  upsertUser,
  COUNTDOWN_SECONDS,
} from './gameStore';

let io: IOServer | null = null;
let spinTimer: NodeJS.Timeout | null = null;
let countdownTimer: NodeJS.Timeout | null = null;

export function getIO(): IOServer | null {
  return io;
}

export function initSocket(server: HTTPServer) {
  if (io) return io;

  io = new IOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Ensure initial round exists
  getOrCreateActiveRound();

  io.on('connection', (socket: Socket) => {
    // Send current state
    const round = getCurrentRound() || getOrCreateActiveRound();
    socket.emit('round_update', round);
    socket.emit('chat_history', getChatHistory(50));

    socket.on('get_state', () => {
      const r = getCurrentRound() || getOrCreateActiveRound();
      socket.emit('round_update', r);
    });

    socket.on('place_bet', (data: { wallet: string; displayName: string; amountLamports: number }) => {
      const { wallet, displayName, amountLamports } = data;
      if (!wallet || !amountLamports) return;

      const result = placeBet(wallet, displayName, amountLamports);
      if (!result.success) {
        socket.emit('bet_error', result.error);
        return;
      }

      const round = result.round!;
      io!.emit('round_update', round);

      // If round just became active (2 players), start countdown
      if (round.status === 'active' && round.players.length === 2) {
        startCountdown(round.id);
      }
    });

    socket.on('send_chat', (data: { wallet: string; displayName: string; message: string }) => {
      const { wallet, displayName, message } = data;
      if (!wallet || !message?.trim()) return;
      const msg = addChatMessage(wallet, displayName, message.trim());
      io!.emit('chat_message', msg);
    });

    socket.on('register_user', (data: { wallet: string; displayName: string }) => {
      const { wallet, displayName } = data;
      if (!wallet) return;
      const user = upsertUser(wallet, displayName || shortenWallet(wallet));
      socket.emit('user_registered', user);
    });

    socket.on('get_user', (wallet: string) => {
      const user = getUser(wallet);
      socket.emit('user_data', user);
    });
  });

  return io;
}

function startCountdown(roundId: string) {
  if (countdownTimer) clearTimeout(countdownTimer);
  if (spinTimer) clearTimeout(spinTimer);

  countdownTimer = setTimeout(() => {
    triggerSpin(roundId);
  }, COUNTDOWN_SECONDS * 1000);
}

function triggerSpin(roundId: string) {
  const round = spinRound(roundId);
  if (!round) return;

  io!.emit('round_update', round);
  io!.emit('spin_started', { roundId });

  // After 5s of spin animation, announce winner
  spinTimer = setTimeout(() => {
    io!.emit('winner_announced', {
      roundId: round.id,
      winnerWallet: round.winnerWallet,
      winnerDisplayName: round.winnerDisplayName,
      winnerShare: round.winnerShare,
      totalPot: round.totalPot,
    });

    // End round after 8s
    setTimeout(() => {
      endRound(roundId);
      const newRound = getCurrentRound() || getOrCreateActiveRound();
      io!.emit('round_update', newRound);
      io!.emit('new_round', { roundId: newRound.id });
    }, 8000);
  }, 5000);
}

function shortenWallet(wallet: string): string {
  return wallet.slice(0, 4) + '...' + wallet.slice(-4);
}
