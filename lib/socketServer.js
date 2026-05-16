const { v4: uuidv4 } = require('uuid');

let io = null;
let countdownTimer = null;
let spinTimer = null;

const HOUSE_FEE = 0.05;
const COUNTDOWN_SECONDS = 30;
const MIN_BET_LAMPORTS = 10_000_000;

const PLAYER_COLORS = [
  '#FF6B35','#FF9F1C','#FFBF69','#F7B731','#FD9644',
  '#FC5C65','#45AAF2','#26DE81','#A55EEA','#FD79A8',
  '#FDCB6E','#6C5CE7','#00B894','#E17055','#74B9FF',
];

// In-memory state
let currentRound = null;
const users = new Map();
const chatHistory = [];

function getColorForPlayer(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function recalcPercentages(round) {
  if (round.totalPot === 0) return;
  round.players.forEach(p => {
    p.percentage = (p.betAmount / round.totalPot) * 100;
  });
}

function createRound() {
  return {
    id: uuidv4(),
    status: 'waiting',
    players: [],
    totalPot: 0,
    winnerWallet: null,
    winnerDisplayName: null,
    winnerShare: 0,
    startedAt: null,
    endedAt: null,
    spinStartAt: null,
    countdownEndsAt: null,
  };
}

function getOrCreateRound() {
  if (!currentRound || currentRound.status === 'ended') {
    currentRound = createRound();
  }
  return currentRound;
}

function placeBet(wallet, displayName, amountLamports) {
  if (amountLamports < MIN_BET_LAMPORTS) {
    return { success: false, error: 'Minimum bet is 0.01 SOL' };
  }
  const round = getOrCreateRound();
  if (round.status === 'spinning' || round.status === 'ended') {
    return { success: false, error: 'Round is not accepting bets' };
  }

  const existingIdx = round.players.findIndex(p => p.wallet === wallet);
  if (existingIdx >= 0) {
    round.players[existingIdx].betAmount += amountLamports;
    round.players[existingIdx].displayName = displayName;
  } else {
    round.players.push({
      wallet,
      displayName,
      betAmount: amountLamports,
      percentage: 0,
      color: getColorForPlayer(round.players.length),
      joinedAt: Date.now(),
    });
  }

  round.totalPot += amountLamports;
  recalcPercentages(round);

  if (round.players.length === 2 && round.status === 'waiting') {
    round.status = 'active';
    round.startedAt = Date.now();
    round.countdownEndsAt = Date.now() + COUNTDOWN_SECONDS * 1000;
  }

  return { success: true, round };
}

function triggerSpin() {
  const round = currentRound;
  if (!round || round.status !== 'active') return;

  round.status = 'spinning';
  round.spinStartAt = Date.now();

  // Weighted random winner
  let rand = Math.random() * round.totalPot;
  let winner = round.players[0];
  for (const p of round.players) {
    rand -= p.betAmount;
    if (rand <= 0) { winner = p; break; }
  }

  const fee = Math.floor(round.totalPot * HOUSE_FEE);
  round.winnerWallet = winner.wallet;
  round.winnerDisplayName = winner.displayName;
  round.winnerShare = round.totalPot - fee;

  // Update user stats
  round.players.forEach(p => {
    const user = users.get(p.wallet);
    if (user) {
      user.totalBet += p.betAmount;
      user.gamesPlayed += 1;
      if (p.wallet === winner.wallet) user.totalWon += round.winnerShare;
    }
  });

  io.emit('round_update', round);
  io.emit('spin_started', { roundId: round.id });

  spinTimer = setTimeout(() => {
    io.emit('winner_announced', {
      roundId: round.id,
      winnerWallet: round.winnerWallet,
      winnerDisplayName: round.winnerDisplayName,
      winnerShare: round.winnerShare,
      totalPot: round.totalPot,
    });

    setTimeout(() => {
      round.status = 'ended';
      round.endedAt = Date.now();
      currentRound = createRound();
      io.emit('round_update', currentRound);
      io.emit('new_round', { roundId: currentRound.id });
    }, 8000);
  }, 5000);
}

function startCountdown(roundId) {
  if (countdownTimer) clearTimeout(countdownTimer);
  if (spinTimer) clearTimeout(spinTimer);
  countdownTimer = setTimeout(() => {
    if (currentRound && currentRound.id === roundId && currentRound.status === 'active') {
      triggerSpin();
    }
  }, COUNTDOWN_SECONDS * 1000);
}

function initSocket(server) {
  if (io) return io;
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: '*' } });

  getOrCreateRound();

  io.on('connection', (socket) => {
    socket.emit('round_update', getOrCreateRound());
    socket.emit('chat_history', chatHistory.slice(-50));

    socket.on('get_state', () => {
      socket.emit('round_update', getOrCreateRound());
    });

    socket.on('place_bet', ({ wallet, displayName, amountLamports }) => {
      if (!wallet || !amountLamports) return;
      const result = placeBet(wallet, displayName, amountLamports);
      if (!result.success) { socket.emit('bet_error', result.error); return; }
      io.emit('round_update', result.round);
      if (result.round.status === 'active' && result.round.players.length === 2) {
        startCountdown(result.round.id);
      }
    });

    socket.on('send_chat', ({ wallet, displayName, message }) => {
      if (!wallet || !message?.trim()) return;
      const msg = { id: uuidv4(), wallet, displayName, message: message.trim().slice(0, 280), timestamp: Date.now() };
      chatHistory.push(msg);
      if (chatHistory.length > 200) chatHistory.splice(0, chatHistory.length - 200);
      io.emit('chat_message', msg);
    });

    socket.on('register_user', ({ wallet, displayName }) => {
      if (!wallet) return;
      const existing = users.get(wallet);
      if (existing) {
        existing.displayName = displayName;
        socket.emit('user_registered', existing);
      } else {
        const user = { wallet, displayName: displayName || wallet.slice(0,4)+'…'+wallet.slice(-4), createdAt: Date.now(), totalWon: 0, totalBet: 0, gamesPlayed: 0 };
        users.set(wallet, user);
        socket.emit('user_registered', user);
      }
    });

    socket.on('get_user', (wallet) => {
      socket.emit('user_data', users.get(wallet) || null);
    });
  });

  return io;
}

module.exports = { initSocket, getOrCreateRound, placeBet, users, chatHistory };
