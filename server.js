require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Optional MongoDB for leaderboard persistence
const MONGO_URI = (process.env.MONGO_URI || '').trim();
let LeaderboardModel = null;
if (MONGO_URI) {
  mongoose.connect(MONGO_URI).then(() => {
    console.log('✅ MongoDB connected (leaderboard persistence enabled)');
  }).catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
  });
  const leaderboardSchema = new mongoose.Schema({
    wallet: { type: String, required: true, unique: true },
    name: { type: String, default: 'Player' },
    points: { type: Number, default: 0 },
    sol: { type: Number, default: 0 }
  }, { collection: 'leaderboard' });
  LeaderboardModel = mongoose.model('Leaderboard', leaderboardSchema);
}
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Block access to private data directory
app.use('/data', (req, res) => {
  res.status(403).send('Access forbidden');
});

// Serve static files FIRST (CSS, JS, images, etc.) - MUST be before other routes
// Audio files are now valid OGG files, so they can be served as static files
app.use(express.static(__dirname, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  index: false, // Don't serve index.html as directory index
  setHeaders: (res, path) => {
    // Set correct MIME type for OGG audio files
    if (path.endsWith('.ogg')) {
      res.setHeader('Content-Type', 'audio/ogg');
    }
    // Set correct MIME type for JavaScript files
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Serve Vite build output
app.use('/dist', express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Serve favicon
app.get('/favicon.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'img', 'favicon1.png'));
});
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'img', 'favicon1.png'));
});
app.get('/img/favicon1.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'img', 'favicon1.png'));
});

// Handle room code URLs (e.g., /?UsCN6Pnv or /?room=UsCN6Pnv)
app.get('/', (req, res) => {
  // Check for room code in query string
  const roomCode = req.query.room || Object.keys(req.query).find(key => key.length === 8 && /^[A-Za-z0-9]+$/.test(key));
  
  if (roomCode && roomCode.length === 8 && /^[A-Za-z0-9]+$/.test(roomCode)) {
    // Valid room code format - look up the room
    const roomId = roomCodes.get(roomCode);
    if (roomId && rooms.has(roomId)) {
      console.log('🔗 Room code lookup:', roomCode, '→', roomId);
    }
  }
  
  // Always serve index.html (room code will be handled by client-side JS)
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static HTML pages
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});

app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, 'faq.html'));
});

// Turnkey config endpoint
app.get('/api/turnkey-config', (req, res) => {
  res.json({
    orgId: process.env.TURNKEY_ORG_ID || '',
    authProxyConfigId: process.env.TURNKEY_AUTH_PROXY_CONFIG_ID || '',
    walletConnectProjectId: process.env.TURNKEY_WALLETCONNECT_PROJECT_ID || ''
  });
});

// Endpoint to get Privy App ID (server-side only, not exposed in client code)
app.get('/api/privy-config', (req, res) => {
  res.json({
    appId: process.env.PRIVY_APP_ID || 'cmkdyx5cg02hvlb0cexfoj8sj'
  });
});

// Proxy endpoint for Privy API calls (to keep API secret server-side)
app.post('/api/privy-auth', async (req, res) => {
  try {
    const { action, email, code, userId } = req.body;
    const PRIVY_APP_ID = process.env.PRIVY_APP_ID || 'cmkdyx5cg02hvlb0cexfoj8sj';
    const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || 'privy_app_secret_aqUDeJsrkVjFdwAz9XtcBvhLWjiSwnDpzojW1JVqBzrKBAfri4pJQbVXTs5Nq6m3xT5hq1BKi7kuFuT1vpgLFuo';
    
    // Create Basic Auth header
    const authString = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
    
    if (action === 'send_code') {
      const response = await fetch('https://auth.privy.io/api/v1/passwordless/send_code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'privy-app-id': PRIVY_APP_ID,
          'Authorization': `Basic ${authString}`
        },
        body: JSON.stringify({
          email: email,
          strategy: 'email'
        })
      });
      
      const data = await response.json();
      res.json(data);
      
    } else if (action === 'verify_code') {
      const response = await fetch('https://auth.privy.io/api/v1/passwordless/verify_code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'privy-app-id': PRIVY_APP_ID,
          'Authorization': `Basic ${authString}`
        },
        body: JSON.stringify({
          email: email,
          code: code,
          strategy: 'email'
        })
      });
      
      const data = await response.json();
      res.json(data);
      
    } else if (action === 'create_wallet') {
      // Create Solana wallet for authenticated user
      const response = await fetch('https://api.privy.io/v1/wallets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'privy-app-id': PRIVY_APP_ID,
          'Authorization': `Basic ${authString}`
        },
        body: JSON.stringify({
          chain_type: 'solana',
          owner: {
            user_id: userId
          }
        })
      });
      
      const data = await response.json();
      res.json(data);
      
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Privy API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Word lists for different languages (loaded from private data file)
const wordLists = require('./data/words.js');

// Game state
const rooms = new Map();
const players = new Map(); // socket.id -> player info
const walletToSocketId = new Map(); // wallet address -> socket.id (one session per wallet)
const publicRooms = new Map(); // Persistent public rooms by language
const roomCodes = new Map(); // roomCode -> roomId mapping for invite links
const roomCodeToId = new Map(); // roomId -> roomCode reverse mapping

// Settings constants
const SETTINGS = {
  LANG: 0,
  SLOTS: 1,
  DRAWTIME: 2,
  ROUNDS: 3,
  WORDCOUNT: 4,
  HINTCOUNT: 5,
  WORDMODE: 6,
  CUSTOMWORDSONLY: 7
};

const GAME_STATE = {
  LOBBY: 7,
  ROUND_START: 2,  // F = 2: Shows "Round $"
  WORD_CHOICE: 3,   // V = 3: Shows word choice to drawer, "choosing word" to others
  DRAWING: 4,       // j = 4: Drawing phase
  ROUND_END: 5,     // Z = 5: Round end
  GAME_END: 6       // X = 6: Game end
};

const WORD_MODE = {
  NORMAL: 0,
  HIDDEN: 1,
  COMBINATION: 2
};

// Data packet IDs
const PACKET = {
  JOIN: 1,
  LEAVE: 2,
  VOTEKICK: 5,
  REPORT: 6,
  MUTE: 7,
  RATE: 8,
  UPDATE_AVATAR: 9,
  UPDATE_NAME: 90,
  GAME_DATA: 10,
  STATE: 11,
  SETTINGS: 12,
  HINTS: 13,
  TIMER: 14,
  GUESS: 15,
  CLOSE: 16,
  OWNER: 17,
  WORD_CHOICE: 18,
  DRAW_DATA: 19,
  CLEAR: 20,
  UNDO: 21,
  CUSTOM_WORDS: 22,
  CHAT: 30,
  SPAM: 31,
  ERROR: 32,
  KICK: 3,
  BAN: 4,
  PRIZE_POOL_UPDATE: 33,
  CLAIM_REWARD: 34,
  REWARD_CLAIMED: 35,
  USE_REWARD_BUYBACK: 36
};

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Generate 8-character alphanumeric room code for invite links
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getRandomWords(lang, count, customWords = null, customWordsOnly = false) {
  let words;
  
  if (customWordsOnly && customWords && customWords.length >= 10) {
    // Only use custom words if customWordsOnly is true
    words = customWords.split(',').map(w => w.trim()).filter(w => w.length > 0 && w.length <= 32);
  } else if (customWords && customWords.length >= 10) {
    // Combine custom words with database
    const customWordsList = customWords.split(',').map(w => w.trim()).filter(w => w.length > 0 && w.length <= 32);
    const databaseWords = wordLists[lang] || wordLists[0];
    words = [...customWordsList, ...databaseWords];
  } else {
    // Use only database words
    words = wordLists[lang] || wordLists[0];
  }
  
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function calculateScore(timeRemaining, totalTime, wordLength, guessPosition) {
  // Enhanced scoring formula with much higher points:
  // Base score = wordLength * 50 (increased from 10), multiplied by time ratio, then by position multiplier
  const baseScore = wordLength * 50; // Increased from 10 to 50
  const timeRatio = timeRemaining / totalTime;
  
  // Position multipliers: 1st = 200% (much more), 2nd = 100%, 3rd = 75%, 4th = 50%, 5th+ = 25%
  let positionMultiplier = 1.0;
  if (guessPosition === 1) positionMultiplier = 2.0;      // First guesser gets DOUBLE points
  else if (guessPosition === 2) positionMultiplier = 1.0;  // Second gets full base
  else if (guessPosition === 3) positionMultiplier = 0.75;
  else if (guessPosition === 4) positionMultiplier = 0.5;
  else positionMultiplier = 0.25;
  
  return Math.floor(baseScore * timeRatio * positionMultiplier);
}

// Calculate drawer's score (drawer gets less points than guessers)
function calculateDrawerScore(guesserScore, guessPosition) {
  // Drawer gets a percentage of the guesser's score, but less than the guesser
  // First guesser gives drawer 50% of their points, others give 30%
  if (guessPosition === 1) {
    return Math.floor(guesserScore * 0.5); // Drawer gets 50% of first guesser's points
  } else {
    return Math.floor(guesserScore * 0.3); // Drawer gets 30% of other guessers' points
  }
}

// Initialize public rooms for each language (only English for now)
function initializePublicRooms() {
  // Only initialize English (lang = 0)
  for (let lang = 0; lang <= 0; lang++) {
    const roomId = `PUBLIC-${lang}`;
    if (!publicRooms.has(roomId)) {
      const room = {
        id: roomId,
        players: [],
        settings: [0, 8, 80, 8, 3, 2, 0, 0], // Default settings (English only) - 8 rounds, 3 words per round, 2 hints
        state: GAME_STATE.LOBBY,
        currentRound: 0,
        currentDrawer: -1,
        currentWord: '',
        currentWordIndex: -1,
        timer: 0,
        drawCommands: [],
        customWords: null,
        owner: null,
        startTime: null,
        timerInterval: null,
        isPublic: true,
        prizePool: 0, // Prize pool in SOL (lamports)
        prizePoolFrozen: false, // True when game ends, freezing the prize pool
        gameStarted: false // Track if game has actually started (not just in lobby)
      };
      publicRooms.set(roomId, room);
      rooms.set(roomId, room);
    }
  }
}

// Leaderboard: real data only, from public lobbies. Persists to MongoDB when MONGO_URI is set.
const leaderboardByWallet = new Map(); // in-memory fallback when no DB

function leaderboardWalletKey(wallet) {
  return (wallet || '').trim().toLowerCase();
}

function leaderboardUpdateFromPublicGame(room) {
  if (!room || !room.isPublic) return;
  const useDb = !!LeaderboardModel;
  room.players.forEach((p) => {
    const wallet = p.walletAddress;
    if (!wallet || typeof wallet !== 'string') return;
    const key = leaderboardWalletKey(wallet);
    const name = (p.name && p.name.trim()) ? p.name.trim() : 'Player';
    const score = p.score || 0;
    if (useDb) {
      LeaderboardModel.findOneAndUpdate(
        { wallet: key },
        { $setOnInsert: { points: 0, sol: 0 }, $inc: { points: score }, $set: { name } },
        { upsert: true, new: true }
      ).catch((err) => console.error('Leaderboard DB update error:', err.message));
      return;
    }
    const current = leaderboardByWallet.get(key) || { name: 'Player', points: 0, sol: 0 };
    leaderboardByWallet.set(key, {
      name: name || current.name,
      points: current.points + score,
      sol: current.sol
    });
  });
}

function leaderboardAddSolEarned(walletAddress, amount, displayName) {
  if (!walletAddress || amount <= 0) return;
  const key = leaderboardWalletKey(walletAddress);
  const name = (displayName && displayName.trim()) ? displayName.trim() : null;
  if (LeaderboardModel) {
    const update = { $setOnInsert: { points: 0, sol: 0 }, $inc: { sol: amount } };
    if (name) update.$set = { name };
    LeaderboardModel.findOneAndUpdate(
      { wallet: key },
      update,
      { upsert: true, new: true }
    ).catch((err) => console.error('Leaderboard DB sol update error:', err.message));
    return;
  }
  const current = leaderboardByWallet.get(key) || { name: 'Player', points: 0, sol: 0 };
  leaderboardByWallet.set(key, {
    name: name || current.name,
    points: current.points,
    sol: current.sol + amount
  });
}

async function getLeaderboardByPoints() {
  if (LeaderboardModel) {
    const docs = await LeaderboardModel.find({ $or: [{ points: { $gt: 0 } }, { sol: { $gt: 0 } }] })
      .sort({ points: -1 })
      .limit(20)
      .lean();
    return docs.map((e, i) => ({ name: e.name, points: e.points || 0, sol: e.sol || 0, rank: i + 1 }));
  }
  return Array.from(leaderboardByWallet.values())
    .filter((e) => e.points > 0 || e.sol > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 20)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

async function getLeaderboardBySol() {
  if (LeaderboardModel) {
    const docs = await LeaderboardModel.find({ sol: { $gt: 0 } })
      .sort({ sol: -1 })
      .limit(20)
      .lean();
    return docs.map((e, i) => ({ name: e.name, points: e.points || 0, sol: e.sol || 0, rank: i + 1 }));
  }
  return Array.from(leaderboardByWallet.values())
    .filter((e) => e.sol > 0)
    .sort((a, b) => b.sol - a.sol)
    .slice(0, 20)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

app.get('/api/leaderboard', async (req, res) => {
  try {
    const by = (req.query.by || 'points').toLowerCase();
    const list = by === 'sol' ? await getLeaderboardBySol() : await getLeaderboardByPoints();
    res.json({ by: by === 'sol' ? 'sol' : 'points', list });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Leaderboard unavailable' });
  }
});

// API endpoint for joining/creating rooms
app.post('/api/play', (req, res) => {
  try {
    console.log('📥 /api/play request received:', {
      body: req.body,
      query: req.query,
      headers: req.headers['content-type']
    });
    
    // Handle form-encoded body (game.js sends "lang=0" or "id=ROOMID" format)
    const body = req.body;
    console.log('📥 /api/play - Request body:', body);
    console.log('📥 /api/play - Request query:', req.query);
    
    // Express.urlencoded() should parse form data automatically
    let isPrivate = body.create === '1' || body.create === 1 || req.query.create === '1' || req.query.create === 1;
    let roomId = body.id || req.query.id || null;
    // Force English only (lang = 0) - language selection is disabled
    let lang = 0;
    
    // Check for room code in body, query, or URL params (for invite links)
    let roomCode = body.roomCode || req.query.roomCode || body.room || req.query.room || 
                   Object.keys(req.query).find(key => key.length === 8 && /^[A-Za-z0-9]+$/.test(key));
    
    // IMPORTANT: game.js sends id=ROOMCODE when URL has room code (e.g., ?UsCN6Pnv)
    // Check if roomId is actually a room code (8 alphanumeric chars)
    if (roomId && roomId.length === 8 && /^[A-Za-z0-9]+$/.test(roomId) && !rooms.has(roomId)) {
      // roomId looks like a room code, try to resolve it
      const codeRoomId = roomCodes.get(roomId);
      if (codeRoomId && rooms.has(codeRoomId)) {
        console.log('🔗 Resolved room code from id param:', roomId, '→', codeRoomId);
        roomCode = roomId;
        roomId = codeRoomId;
      }
    }
    
    console.log('📥 /api/play - Parsed:', { isPrivate, roomId, lang, roomCode });
    
    // IMPORTANT: game.js create button sends "lang=X" (no create param in API call)
    // The create flag is sent in Socket.IO login event (line 1753: create: n ? 1 : 0)
    // So API can't distinguish create vs play from request alone
    // Solution: API always returns a room ID
    // - If create=1 in API: create private room
    // - If id=ROOMID: return that room (or create if doesn't exist)  
    // - If only lang: create/join public room (Socket.IO will handle create flag)
    
    // Check for room code in query (for invite links like ?UsCN6Pnv)
    if (roomCode && !roomId) {
      const codeRoomId = roomCodes.get(roomCode);
      if (codeRoomId && rooms.has(codeRoomId)) {
        roomId = codeRoomId;
        console.log('🔗 Room code resolved:', roomCode, '→', roomId);
      }
    }
    
    // For private rooms (create=1), always generate a new room ID and code
    if (isPrivate && !roomId) {
      roomId = generateRoomId();
      const roomCode = generateRoomCode();
      
      // Create new private room
      const room = {
        id: roomId,
        code: roomCode, // Store code in room object
        players: [],
        settings: [0, 8, 80, 8, 3, 0, 0, 0], // Force English (lang = 0), 8 rounds
        state: GAME_STATE.LOBBY,
        currentRound: 0,
        currentDrawer: -1,
        currentWord: '',
        currentWordIndex: -1,
        timer: 0,
        drawCommands: [],
        customWords: null,
        owner: null,
        startTime: null,
        timerInterval: null,
        isPublic: false,
        prizePool: 0, // Prize pool in SOL (lamports)
        prizePoolFrozen: false, // True when game ends, freezing the prize pool
        gameStarted: false // Track if game has actually started (not just in lobby)
      };
      rooms.set(roomId, room);
      
      // Map room code to room ID for invite links
      roomCodes.set(roomCode, roomId);
      roomCodeToId.set(roomId, roomCode);
      console.log('🔗 Created private room with code:', roomCode, '→', roomId);
    } else if (!roomId) {
      // No roomId provided - this could be:
      // 1. Public room join (Play button) - find available lobby or create new one
      // Public rooms: fixed settings, auto-start at exactly 8 players, max 8 players
      // Settings: [LANG, SLOTS, DRAWTIME, ROUNDS, WORDCOUNT, HINTCOUNT, WORDMODE, CUSTOMWORDSONLY]
      // Fixed: [0, 8, 80, 8, 3, 2, 0, 0] = English, 8 max, 80s draw, 8 rounds, 3 words per round, 2 hints
      
      // Find an available public lobby (in LOBBY state with < 8 players)
      // IMPORTANT: Only join LOBBY state rooms, never join running games
      let availableRoom = null;
      for (const [id, room] of rooms.entries()) {
        if (room.isPublic && 
            room.state === GAME_STATE.LOBBY && 
            room.players.length < 8) {
          availableRoom = room;
          roomId = id;
          break;
        }
      }
      
      // If no available room, create a new one
      if (!availableRoom) {
        // Generate unique room ID
        roomId = `PUBLIC-${lang}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        availableRoom = {
          id: roomId,
          players: [],
          settings: [0, 8, 80, 8, 3, 2, 0, 0], // Fixed settings: English, 8 max, 80s, 8 rounds, 3 words per round, 2 hints
          state: GAME_STATE.LOBBY,
          currentRound: 0,
          currentDrawer: -1,
          currentWord: '',
          currentWordIndex: -1,
          timer: 0,
          drawCommands: [],
          customWords: null,
          owner: null, // No owner for public rooms
          startTime: null,
          timerInterval: null,
          hintInterval: null,
          hintIndex: 0,
          isPublic: true,
          autoStartTimer: null, // Timer for auto-starting when exactly 8 players
          prizePool: 0, // Prize pool in SOL (lamports)
          prizePoolFrozen: false, // True when game ends, freezing the prize pool
          gameStarted: false // Track if game has actually started (not just in lobby)
        };
        rooms.set(roomId, availableRoom);
        console.log('✅ Created new public lobby:', roomId);
      }
      
      roomId = availableRoom.id;
    }
    
    const room = rooms.get(roomId);
    if (!room) {
      console.error('❌ Room not found:', roomId);
      return res.status(404).json({ 
        success: false,
        error: 'Room not found' 
      });
    }
    
    if (room.players.length >= room.settings[SETTINGS.SLOTS]) {
      console.error('❌ Room is full:', roomId);
      return res.status(400).json({ 
        success: false,
        error: 'Room is full' 
      });
    }
    
    // Return response in format game.js expects
    // IMPORTANT: Always return HTTPS URL on Render (even if request was HTTP)
    let responseUrl = req.protocol + '://' + req.get('host');
    
    // Force HTTPS on Render or custom domain
    const host = req.get('host');
    if (host && (host.includes('onrender.com') || host.includes('doodls.fun'))) {
      responseUrl = 'https://' + host;
    }
    
    console.log('✅ /api/play response:', { success: true, data: responseUrl, roomId: roomId, isPrivate });
    res.json({
      success: true,
      data: responseUrl,  // Return URL for na() function
      roomId: roomId       // Store room ID for Socket.IO
    });
  } catch (error) {
    console.error('❌ Error in /api/play:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Anti-spam tracking per socket
const spamTracker = new Map(); // socket.id -> { messages: [], lastMessage: timestamp, warnings: 0, lastWarningTime: 0 }

// Anti-spam configuration
const SPAM_CONFIG = {
  INSTANT_SPAM_THRESHOLD_MS: 300,   // Threshold for all warnings (300ms - only very fast messages)
  INSTANT_SPAM_COUNT: 3,             // Need 3 instant spam messages for first warning
  RATE_SPAM_WINDOW_MS: 4000,         // Time window to check for rate-based spam (4 seconds)
  RATE_SPAM_COUNT: 6,                // Max messages allowed in RATE_SPAM_WINDOW_MS before warning (higher = less strict)
  MAX_WARNINGS: 3,                   // Kick after 3 warnings
  WARNING_COOLDOWN_MS: 0,            // No cooldown - show warnings immediately
  WARNING_RESET_TIME_MS: 5000        // Reset warnings if no spam for 5 seconds
};

function kickPlayer(room, playerId, reason) {
  console.log(`[KICK] ========================================`);
  console.log(`[KICK] kickPlayer called for ${playerId}, reason: ${reason}`);
  console.log(`[KICK] Room: ${room ? room.id : 'null'}`);
  console.log(`[KICK] ========================================`);
  try {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (!playerSocket) {
      console.log(`[KICK] ERROR: Socket ${playerId} not found in io.sockets.sockets!`);
      console.log(`[KICK] Available sockets:`, Array.from(io.sockets.sockets.keys()));
      // Socket already disconnected, just remove from room and clean up
      const index = room.players.findIndex(p => p.id === playerId);
      if (index !== -1) {
        room.players.splice(index, 1);
      }
      spamTracker.delete(playerId);
      return;
    }
    console.log(`[KICK] ✓ Socket found for ${playerId}`);
    
    const index = room.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      const kickedPlayer = room.players[index];
      room.players.splice(index, 1);
      
      // CRITICAL: Emit 'reason' event FIRST, then disconnect IMMEDIATELY
      // This ensures the client receives the reason and can disable input before disconnect
      try {
        console.log(`[KICK] Step 1: Emitting 'reason' event to ${playerId} with reason ${reason}`);
        playerSocket.emit('reason', reason);
        console.log(`[KICK] Step 2: Reason event emitted successfully`);
      } catch (error) {
        console.error('[KICK] ERROR emitting reason event:', error);
      }
      
      // Disconnect IMMEDIATELY after emitting reason - this prevents any further messages
      try {
        console.log(`[KICK] Step 3: Disconnecting socket ${playerId} immediately...`);
        playerSocket.disconnect(true);
        console.log(`[KICK] Step 4: Socket ${playerId} disconnected - DONE!`);
      } catch (error) {
        console.error('[KICK] ERROR in disconnect process:', error);
        // Force disconnect even on error
        try {
          playerSocket.disconnect(true);
        } catch (e) {
          console.error('[KICK] ERROR in force disconnect:', e);
        }
      }
      
      // Send leave event to room AFTER disconnecting (so kicked player doesn't receive it)
      // This will show the kick message to other players
      try {
        io.to(room.id).emit('data', {
          id: PACKET.LEAVE,
          data: {
            id: playerId,
            reason: reason
          }
        });
      } catch (error) {
        console.error('Error sending leave event:', error);
      }
      
      // Clean up spam tracker AFTER disconnecting
      spamTracker.delete(playerId);
    } else {
      // Player not found in room, just clean up
      spamTracker.delete(playerId);
    }
  } catch (error) {
    console.error('Error in kickPlayer:', error);
    // Clean up spam tracker even on error
    spamTracker.delete(playerId);
  }
}

function checkSpam(socketId, message, room) {
  const now = Date.now();
  let tracker = spamTracker.get(socketId);
  
  if (!tracker) {
    tracker = {
      recentMessages: [],             // Track recent messages with timestamps
      lastMessageTime: 0,             // Track last message time separately
      warnings: 0,
      lastWarningTime: 0,
      lastSpamTime: 0                 // Track last spam detection time
    };
    spamTracker.set(socketId, tracker);
  }
  
  // Save previous last message time BEFORE updating
  const previousLastMessageTime = tracker.lastMessageTime;
  
  // Use same threshold for all warnings
  const currentThreshold = SPAM_CONFIG.INSTANT_SPAM_THRESHOLD_MS;
  
  // Check if this is an "instant spam" message (sent within threshold of previous message)
  let isInstantSpam = false;
  if (previousLastMessageTime > 0) {
    const timeSinceLastMessage = now - previousLastMessageTime;
    if (timeSinceLastMessage <= currentThreshold) {
      isInstantSpam = true;
    }
  }
  
  // For warnings after first, also check for slower but consistent spam (within 500ms)
  // This catches slower spamming patterns, but not too slow to avoid false positives
  let isSlowSpam = false;
  if (tracker.warnings > 0 && previousLastMessageTime > 0) {
    const timeSinceLastMessage = now - previousLastMessageTime;
    // Only catch messages between 300-500ms (slower than instant but still fast)
    if (timeSinceLastMessage <= 500 && timeSinceLastMessage > currentThreshold) {
      isSlowSpam = true;
    }
  }
  
  // Reset warnings if user stopped spamming (no spam for WARNING_RESET_TIME_MS)
  // Check this AFTER determining if current message is spam, but BEFORE processing warnings
  if (tracker.warnings > 0 && tracker.lastSpamTime > 0) {
    const timeSinceLastSpam = now - tracker.lastSpamTime;
    if (timeSinceLastSpam > SPAM_CONFIG.WARNING_RESET_TIME_MS) {
      // User stopped spamming for 5+ seconds - reset warnings
      console.log(`[SPAM] Resetting warnings for ${socketId} - no spam for ${timeSinceLastSpam}ms`);
      tracker.warnings = 0;
      tracker.lastWarningTime = 0;
      tracker.recentMessages = [];
      tracker.lastSpamTime = 0; // Reset this too
    }
  }
  
  // Update last message time AFTER checking (so next message can compare against this one)
  tracker.lastMessageTime = now;
  
  // Add current message to recent messages
  tracker.recentMessages.push(now);
  
  // Clean up messages older than the rate spam window
  tracker.recentMessages = tracker.recentMessages.filter(msgTime => now - msgTime < SPAM_CONFIG.RATE_SPAM_WINDOW_MS);
  
  // Check if we have enough consecutive instant spam messages for a warning
  let shouldWarn = false;
  let shouldKick = false;
  
  // Count consecutive instant spam messages - need to check if we have exactly 3 messages
  // For 3 messages, we need 2 consecutive gaps (message1->message2 and message2->message3)
  let consecutiveInstantSpam = 0;
  if (tracker.recentMessages.length >= 2) {
    for (let i = tracker.recentMessages.length - 1; i > 0; i--) {
      const timeDiff = tracker.recentMessages[i] - tracker.recentMessages[i - 1];
      if (timeDiff <= SPAM_CONFIG.INSTANT_SPAM_THRESHOLD_MS) {
        consecutiveInstantSpam++;
      } else {
        break; // Stop counting if there's a gap
      }
    }
  }
  
  // For first warning, we need EXACTLY 3 messages within threshold
  // This means: recentMessages.length === 3 AND consecutiveInstantSpam === 2
  // (2 gaps means 3 messages: msg1->msg2->msg3)
  const hasExactlyThreeInstantSpamMessages = tracker.recentMessages.length === 3 && consecutiveInstantSpam === 2;
  
  // Check rate-based spam (messages per time window) - for first warning only
  const messagesInWindow = tracker.recentMessages.length;
  const isRateSpam = messagesInWindow >= SPAM_CONFIG.RATE_SPAM_COUNT;
  
  // Update last spam time if spam is detected (for reset logic)
  if (isInstantSpam || isRateSpam || isSlowSpam) {
    tracker.lastSpamTime = now;
  }
  
  // Debug logging
  if (tracker.warnings > 0 || isInstantSpam || isRateSpam || isSlowSpam) {
    console.log(`[SPAM DEBUG] socketId: ${socketId}, warnings: ${tracker.warnings}, isInstantSpam: ${isInstantSpam}, isSlowSpam: ${isSlowSpam}, isRateSpam: ${isRateSpam}, consecutiveInstantSpam: ${consecutiveInstantSpam}, messagesInWindow: ${messagesInWindow}, timeSinceLast: ${previousLastMessageTime > 0 ? now - previousLastMessageTime : 'N/A'}ms`);
  }
  
  if (tracker.warnings === 0) {
    // First warning: on instant spam (EXACTLY 3 messages within 500ms) OR rate spam (4+ messages in 4 seconds)
    // MUST have exactly 3 messages - check hasExactlyThreeInstantSpamMessages
    if (hasExactlyThreeInstantSpamMessages || isRateSpam) {
      shouldWarn = true;
      tracker.warnings = 1;
      tracker.lastWarningTime = now;
      console.log(`[SPAM] First warning - hasExactlyThreeInstantSpamMessages: ${hasExactlyThreeInstantSpamMessages}, rateSpam: ${isRateSpam}, consecutiveInstantSpam: ${consecutiveInstantSpam}, messagesInWindow: ${messagesInWindow}, recentMessages.length: ${tracker.recentMessages.length}`);
      // DON'T clear - keep tracking for next check
    }
  } else if (tracker.warnings === 1) {
    // Second warning: on instant spam OR slow spam (catches slower spamming after first warning)
    if (isInstantSpam || isSlowSpam) {
      shouldWarn = true;
      tracker.warnings = 2;
      tracker.lastWarningTime = now;
      console.log(`[SPAM] Second warning - instantSpam: ${isInstantSpam}, slowSpam: ${isSlowSpam}, timeSinceLast: ${previousLastMessageTime > 0 ? now - previousLastMessageTime : 'N/A'}ms`);
    }
  } else if (tracker.warnings === 2) {
    // Third warning: on instant spam OR slow spam (catches slower spamming after second warning)
    if (isInstantSpam || isSlowSpam) {
      shouldWarn = true;
      tracker.warnings = 3;
      tracker.lastWarningTime = now;
      console.log(`[SPAM] Third warning shown, warnings now = ${tracker.warnings} - instantSpam: ${isInstantSpam}, slowSpam: ${isSlowSpam}, timeSinceLast: ${previousLastMessageTime > 0 ? now - previousLastMessageTime : 'N/A'}ms`);
      // After showing 3rd warning, the NEXT spam message should kick (no warning)
    }
  } else if (tracker.warnings >= 3) {
    // After 3 warnings, only kick if they CONTINUE spamming (instant or slow)
    // NO WARNING MESSAGE - just kick immediately
    // If they stopped spamming, warnings should have been reset above
    if (isInstantSpam || isSlowSpam) {
      shouldKick = true;
      console.log(`[SPAM] Kicking ${socketId} - continued instant spam after 3 warnings (no warning shown)`);
      // Kick the player immediately - owner can be kicked for spam
      if (room) {
        const player = room.players.find(p => p.id === socketId);
        if (player) {
          // Transfer ownership if owner is being kicked
          if (room.owner === socketId && room.players.length > 1) {
            const remainingPlayers = room.players.filter(p => p.id !== socketId);
            if (remainingPlayers.length > 0) {
              room.owner = remainingPlayers[0].id;
              // Notify room of owner change
              io.to(room.id).emit('data', {
                id: PACKET.OWNER,
                data: room.owner
              });
            }
          }
          // Kick immediately - call synchronously
              kickPlayer(room, socketId, 1); // Kick reason 1
        }
      }
    } else {
      // Not instant spam after 3 warnings - this shouldn't happen if reset works,
      // but if it does, just log it (warnings should reset on next message if 5+ seconds passed)
      console.log(`[SPAM] User ${socketId} has 3 warnings but sent non-instant message - warnings should reset if 5+ seconds passed`);
    }
  }
  
  // Return result - kick takes priority over warning
  // IMPORTANT: If we're kicking, NEVER show a warning message
  if (shouldKick) {
    console.log(`[SPAM] Returning shouldKick=true for ${socketId} - NO WARNING will be shown`);
    // Explicitly set shouldWarn to false to prevent any warning message
    shouldWarn = false;
    return { isSpam: true, shouldKick: true, shouldWarn: false, warnings: tracker.warnings };
  }
  
  if (shouldWarn) {
    console.log(`[SPAM] Returning shouldWarn=true for ${socketId}, warnings: ${tracker.warnings}`);
    return { isSpam: true, shouldWarn: true, warnings: tracker.warnings };
  }
  
  // Not spam
  return { isSpam: false };
}

io.on('connection', (socket) => {
  let player = null;
  let currentRoomId = null;
  
  // Handle socket errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket ${socket.id} disconnected: ${reason}`);
    // Cleanup is handled in the disconnect handler below
  });
  
  socket.on('login', (data) => {
    try {
    const { join, create, name, code, avatar, walletAddress } = data;
    // Force English only (lang = 0)
    const lang = 0;
    let roomId = join || code;
    
    // Wallet is optional for play; required only when claiming SOL (can connect then or enter address at claim)
    const walletTrimmed = (walletAddress && typeof walletAddress === 'string') ? walletAddress.trim() : '';
    
    // Limit name to 16 characters
    const playerName = (name || 'Player').trim().substring(0, 16);
    
    console.log('🔐 Socket.IO login:', { join, create, name: playerName, lang, code, roomId, wallet: walletTrimmed ? walletTrimmed.substring(0, 8) + '...' : '(none)' });
    
    // IMPORTANT: If create=1, this is a private room create request
    // The API might have returned a public room ID, but we need to create a private room
    if (create === 1 || create === '1') {
      // This is a create private room request - generate new room ID and code
      roomId = generateRoomId();
      const roomCode = generateRoomCode();
      console.log('🔧 Creating private room:', roomId, 'with code:', roomCode);
      
      // Create the room if it doesn't exist
      if (!rooms.has(roomId)) {
        const room = {
          id: roomId,
          code: roomCode,
          players: [],
          settings: [0, 8, 80, 8, 3, 0, 0, 0], // Force English (lang = 0), 8 rounds
          state: GAME_STATE.LOBBY,
          currentRound: 0,
          currentDrawer: -1,
          currentWord: '',
          currentWordIndex: -1,
          timer: 0,
          drawCommands: [],
          customWords: null,
          owner: null,
          startTime: null,
          timerInterval: null,
          hintInterval: null,
          hintIndex: 0,
          wordChoiceTimer: null,
          isPublic: false,
          prizePool: 0, // Prize pool in SOL (lamports)
          prizePoolFrozen: false, // True when game ends, freezing the prize pool
          gameStarted: false // Track if game has actually started (not just in lobby)
        };
        rooms.set(roomId, room);
        roomCodes.set(roomCode, roomId);
        roomCodeToId.set(roomId, roomCode);
      }
    } else if (roomId) {
      // Check if roomId is actually a room code (8 alphanumeric chars) and resolve it
      // This handles invite links where users join with a room code
      if (roomId.length === 8 && /^[A-Za-z0-9]+$/.test(roomId) && !rooms.has(roomId)) {
        const resolvedRoomId = roomCodes.get(roomId);
        if (resolvedRoomId && rooms.has(resolvedRoomId)) {
          console.log('🔗 Resolved room code in Socket.IO login:', roomId, '→', resolvedRoomId);
          roomId = resolvedRoomId;
        } else {
          console.log('⚠️ Room code not found:', roomId);
          socket.emit('joinerr', 1); // Room not found
          return;
        }
      }
    }
    
    if (!roomId) {
      socket.emit('joinerr', 1); // Room not found
      return;
    }
    
    // Room should already exist from /api/play call, but create if it doesn't (fallback)
    if (!rooms.has(roomId)) {
      const room = {
        id: roomId,
        players: [],
          settings: [0, 8, 80, 8, 3, 0, 0, 0], // Force English (lang = 0), 8 rounds
        state: GAME_STATE.LOBBY,
        currentRound: 0,
        currentDrawer: -1,
        currentWord: '',
        currentWordIndex: -1,
        timer: 0,
        drawCommands: [],
        customWords: null,
        owner: socket.id,
        startTime: null,
        timerInterval: null,
        hintInterval: null,
          hintIndex: 0,
          wordChoiceTimer: null,
          isPublic: create !== 1 && create !== '1',
          prizePool: 0, // Prize pool in SOL (lamports)
          prizePoolFrozen: false, // True when game ends, freezing the prize pool
          gameStarted: false // Track if game has actually started (not just in lobby)
      };
      rooms.set(roomId, room);
      console.log('✅ Created room:', roomId, 'isPublic:', room.isPublic);
    }
    
    let room = rooms.get(roomId);
    if (!room) {
      console.log('⚠️ Room not found in Socket.IO login:', roomId);
      socket.emit('joinerr', 1); // Room not found
      return;
    }
    
    // For public rooms, only allow joining if room is in LOBBY state
    // Never allow joining a running public game - redirect to waiting lobby
    if (room.isPublic && room.state !== GAME_STATE.LOBBY) {
      console.log('⚠️ Cannot join running public game:', roomId, 'state:', room.state, '- finding waiting lobby');
      // Find an available waiting lobby
      let newLobbyId = null;
      for (const [id, r] of rooms.entries()) {
        if (r.isPublic && r.state === GAME_STATE.LOBBY && r.players.length < 8) {
          newLobbyId = id;
          break;
        }
      }
      
      // If no available lobby, create one
      if (!newLobbyId) {
        newLobbyId = `PUBLIC-${lang}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newLobby = {
          id: newLobbyId,
          players: [],
          settings: [0, 8, 80, 8, 3, 2, 0, 0],
          state: GAME_STATE.LOBBY,
          currentRound: 0,
          currentDrawer: -1,
          currentWord: '',
          currentWordIndex: -1,
          timer: 0,
          drawCommands: [],
          customWords: null,
          owner: null,
          startTime: null,
          timerInterval: null,
          hintInterval: null,
          hintIndex: 0,
          isPublic: true,
          autoStartTimer: null,
          prizePool: 0, // Prize pool in SOL (lamports)
          prizePoolFrozen: false, // True when game ends, freezing the prize pool
          gameStarted: false // Track if game has actually started (not just in lobby)
        };
        rooms.set(newLobbyId, newLobby);
        console.log('✅ Created new waiting lobby for player trying to join running game:', newLobbyId);
      }
      
      // Update roomId to the new lobby
      roomId = newLobbyId;
      room = rooms.get(roomId);
      if (!room) {
        socket.emit('joinerr', 1);
        return;
      }
    }
    
    if (room.players.length >= room.settings[SETTINGS.SLOTS]) {
      console.log('⚠️ Room is full:', roomId, `(${room.players.length}/${room.settings[SETTINGS.SLOTS]} players)`);
      socket.emit('joinerr', 2); // Room full
      return;
    }
    
    // One wallet per session (only when wallet provided): reject if this wallet is already in use by another connected socket
    if (walletTrimmed) {
      for (const [sid, s] of io.sockets.sockets) {
        if (sid === socket.id) continue;
        const otherPlayer = players.get(sid);
        if (otherPlayer && otherPlayer.walletAddress && otherPlayer.walletAddress.trim() === walletTrimmed) {
          console.log('⚠️ Login rejected - wallet already in use:', walletTrimmed.substring(0, 8) + '...', 'by socket', sid);
          socket.emit('joinerr', 6); // Wallet already in use (another tab)
          return;
        }
      }
      walletToSocketId.set(walletTrimmed, socket.id);
    }
    
    // Create player
    player = {
      id: socket.id,
      name: playerName, // Already limited to 16 characters above
      avatar: avatar || [0, 0, 0, -1],
      score: 0,
      guessed: false,
      flags: 0,
      roomId: roomId,
      walletAddress: walletTrimmed // Store wallet address for prize claims (empty if not connected)
    };
    
    players.set(socket.id, player);
    socket.join(roomId);
    currentRoomId = roomId;
    
    // Add player to room
    room.players.push(player);
    
    // Public rooms have no owner (no host controls)
    // Private rooms get owner set
    if (!room.isPublic && !room.owner) {
      room.owner = socket.id;
    }
    // Ensure public rooms never have an owner and isPublic is explicitly set
    const isPublicRoom = room.isPublic === true;
    if (isPublicRoom) {
      room.owner = null;
      room.isPublic = true; // Ensure it's explicitly true
    } else {
      room.isPublic = false; // Ensure it's explicitly false for private rooms
    }
    
    // Send game data (include room code for private rooms)
    // CRITICAL: For public rooms, type must be 0, owner must be null, and isPublic must be true to show waiting screen
    const gameData = {
      me: socket.id,
      type: isPublicRoom ? 0 : (create === 1 || create === '1' ? 1 : 0), // Public = 0, Private = 1
      id: roomId,
      users: room.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        guessed: p.guessed === true ? true : false,
        flags: p.flags
      })),
      round: room.state === GAME_STATE.LOBBY ? 0 : (room.currentRound > 0 ? room.currentRound - 1 : 0), // Send 0-indexed round
      owner: isPublicRoom ? null : room.owner, // Public rooms must have null owner
      settings: room.settings,
      state: {
        id: room.state,
        time: room.timer,
        data: room.state === GAME_STATE.DRAWING ? {
          id: room.currentDrawer,
          word: room.currentDrawer === socket.id ? room.currentWord : undefined,
          wordLength: room.currentDrawer !== socket.id && room.currentWord ? room.currentWord.length : undefined, // Send word length for non-drawers
          wordStructure: room.currentDrawer !== socket.id && room.currentWord ? room.currentWord.replace(/[^\s\-]/g, '_') : undefined, // Send word structure with underscores, preserving spaces and dashes
          hints: (room.revealedIndices && room.currentWord) ? Array.from(room.revealedIndices).map(idx => [idx, room.currentWord.charAt(idx)]) : [], // Send already revealed hints
          drawCommands: room.drawCommands
        } : {}
      },
      isPublic: isPublicRoom, // Explicitly set isPublic flag (true for public, false for private)
      prizePool: room.prizePool || 0,
      prizePoolFrozen: room.prizePoolFrozen || false
    };
    
    // Add room code for private rooms (for invite links)
    if (room.code) {
      gameData.code = room.code;
    }
    
    // CRITICAL: Send GAME_DATA IMMEDIATELY - this must arrive before STATE packets
    console.log(`📤 Sending GAME_DATA to ${socket.id} for room ${roomId}:`, {
      type: gameData.type,
      isPublic: gameData.isPublic,
      owner: gameData.owner,
      roomState: gameData.state.id
    });
    socket.emit('data', {
      id: PACKET.GAME_DATA,
      data: gameData
    });
    
    // For public rooms, also send it after a tiny delay to ensure it's processed
    if (isPublicRoom) {
      setTimeout(() => {
        console.log(`📤 Sending duplicate GAME_DATA to ${socket.id} (public room):`, {
          type: gameData.type,
          isPublic: gameData.isPublic,
          owner: gameData.owner
        });
        socket.emit('data', {
          id: PACKET.GAME_DATA,
          data: gameData
        });
      }, 10);
    }
    
    // Broadcast join to other players
    socket.to(roomId).emit('data', {
      id: PACKET.JOIN,
      data: {
        id: socket.id,
        name: player.name,
        avatar: player.avatar,
        score: 0,
        guessed: false,
        flags: 0
      }
    });
    
    // For public rooms in LOBBY, ALWAYS send updated GAME_DATA to ALL players
    // to ensure they ALL see the waiting screen (not settings) when new players join
    // CRITICAL: This must happen EVERY time someone joins to prevent settings screen from showing
    if (room.isPublic && room.state === GAME_STATE.LOBBY) {
      // CRITICAL: Ensure room.isPublic is explicitly true and owner is null
      room.isPublic = true;
      room.owner = null; // Ensure no owner
      
      // Small delay to ensure JOIN packet is processed first
      setTimeout(() => {
        // Send updated GAME_DATA to ALL players to ensure consistency
        room.players.forEach(p => {
          const updatedGameData = {
            me: p.id, // Each player's own ID
            type: 0, // Public room - CRITICAL: must be 0
            id: room.id,
            users: room.players.map(pl => ({
              id: pl.id,
              name: pl.name,
              avatar: pl.avatar,
              score: pl.score,
              guessed: pl.guessed === true ? true : false,
              flags: pl.flags
            })),
            round: room.state === GAME_STATE.LOBBY ? 0 : (room.currentRound > 0 ? room.currentRound - 1 : 0), // Send 0-indexed round
            owner: null, // Public rooms have no owner - CRITICAL
            settings: room.settings,
            state: {
              id: room.state,
              time: 0,
              data: {}
            },
            isPublic: true, // CRITICAL: must be explicitly true
            prizePool: room.prizePool || 0,
            prizePoolFrozen: room.prizePoolFrozen || false
          };
          io.to(p.id).emit('data', {
            id: PACKET.GAME_DATA,
            data: updatedGameData
          });
        });
      }, 50); // Small delay to ensure JOIN is processed first
    }
    
    // Auto-start public rooms when exactly 8 players join
    if (room.isPublic && room.state === GAME_STATE.LOBBY) {
      // Clear any existing auto-start timer
      if (room.autoStartTimer) {
        clearTimeout(room.autoStartTimer);
        room.autoStartTimer = null;
      }
      
      // If we have exactly 8 players, auto-start immediately
      if (room.players.length === 8) {
        console.log(`🎮 Auto-starting public room ${roomId} with exactly 8 players`);
        // Start the game immediately
        startGame(room);
        
        // Create a new waiting lobby for future players
        const newLobbyId = `PUBLIC-${lang}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newLobby = {
          id: newLobbyId,
          players: [],
          settings: [0, 8, 80, 8, 3, 2, 0, 0], // Fixed settings: English, 8 max, 80s, 8 rounds, 3 words per round, 2 hints
          state: GAME_STATE.LOBBY,
          currentRound: 0,
          currentDrawer: -1,
          currentWord: '',
          currentWordIndex: -1,
          timer: 0,
          drawCommands: [],
          customWords: null,
          owner: null,
          startTime: null,
          timerInterval: null,
          hintInterval: null,
          hintIndex: 0,
          isPublic: true,
          autoStartTimer: null
        };
        rooms.set(newLobbyId, newLobby);
        console.log('✅ Created new waiting lobby:', newLobbyId);
      }
      }
    } catch (error) {
      console.error(`❌ Error in login handler for ${socket.id}:`, error);
      console.error('Stack:', error.stack);
      socket.emit('loginerr', { id: 32, message: 'Login failed due to server error' });
    }
  });
  
  socket.on('data', (data) => {
    try {
    if (!player || !currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    
    switch (data.id) {
      case PACKET.SETTINGS:
        // Block settings changes for public rooms (no host controls)
        if (room.isPublic) {
          console.log('🚫 Settings change blocked for public room:', currentRoomId);
          return; // Ignore settings changes for public rooms
        }
        // Block WORDMODE changes (remove word mode setting)
        if (data.data.id === SETTINGS.WORDMODE) {
          console.log('🚫 Word mode setting change blocked');
          return; // Ignore word mode setting changes
        }
        if (room.owner === socket.id) {
          room.settings[data.data.id] = data.data.val;
          io.to(currentRoomId).emit('data', {
            id: PACKET.SETTINGS,
            data: data.data
          });
        }
        break;
        
      case PACKET.CUSTOM_WORDS:
        // Block custom words for public rooms (they auto-start)
        if (room.isPublic) {
          console.log('🚫 Custom words blocked for public room:', currentRoomId);
          return; // Ignore custom words for public rooms
        }
        if (room.owner === socket.id) {
          // Check minimum 2 players requirement
          if (room.players.length < 2) {
            // Send error message to owner
            socket.emit('data', {
              id: PACKET.CLOSE,
              data: 'Minimum 2 players required to start the game!'
            });
            return;
          }
          
          // Store custom words if provided
          if (data.data && data.data.trim().length > 0) {
            room.customWords = data.data;
          }
          
          // Start the game
          startGame(room);
        }
        break;
        
      case PACKET.WORD_CHOICE:
        if (room.state === GAME_STATE.WORD_CHOICE && room.currentDrawer === socket.id) {
          // Clear word choice timer
          if (room.wordChoiceTimer) {
            clearInterval(room.wordChoiceTimer);
            room.wordChoiceTimer = null;
          }
          
          const wordIndex = Array.isArray(data.data) ? data.data[0] : data.data;
          const words = room.currentWords || getRandomWords(
            room.settings[SETTINGS.LANG],
            room.settings[SETTINGS.WORDCOUNT],
            room.customWords,
            room.settings[SETTINGS.CUSTOMWORDSONLY] === 1
          );
          if (words && words[wordIndex] !== undefined) {
            room.currentWord = words[wordIndex];
          room.state = GAME_STATE.DRAWING;
          room.timer = room.settings[SETTINGS.DRAWTIME];
          room.startTime = Date.now();
          room.drawCommands = [];
          room.hintIndex = 0;
          room.hintInterval = null;
          room.revealedIndices = new Set(); // Track which letter positions have been revealed
            
            // Start drawing timer
            startRoundTimer(room);
            
            // Start hint system (always enabled, reveals at 44s and 25s)
            startHintSystem(room);
            
          // Send DRAWING state - drawer gets word, others don't
          // Send to drawer with word
          io.to(room.currentDrawer).emit('data', {
            id: PACKET.STATE,
            data: {
              id: GAME_STATE.DRAWING, // j = 4
              time: room.timer,
              data: {
                id: room.currentDrawer,
                word: room.currentWord, // Drawer sees the word
                hints: [],
                drawCommands: []
              }
            }
          });
          
          // Send to other players without word (but send word length for display)
          room.players.forEach(player => {
            if (player.id !== room.currentDrawer) {
              io.to(player.id).emit('data', {
                id: PACKET.STATE,
                data: {
                  id: GAME_STATE.DRAWING, // j = 4
                  time: room.timer,
                  data: {
                    id: room.currentDrawer,
                    word: undefined, // Others don't see the word
                    wordLength: room.currentWord ? room.currentWord.length : 0, // Send word length for underscore display
                    wordStructure: room.currentWord ? room.currentWord.replace(/[^\s\-]/g, '_') : undefined, // Send word structure with underscores, preserving spaces and dashes
                    hints: [],
                    drawCommands: []
                  }
                }
              });
            }
          });
          }
        }
        break;
        
      case PACKET.DRAW_DATA:
        if (room.state === GAME_STATE.DRAWING && room.currentDrawer === socket.id) {
          room.drawCommands.push(...data.data);
          socket.to(currentRoomId).emit('data', {
            id: PACKET.DRAW_DATA,
            data: data.data
          });
        }
        break;
        
      case PACKET.CLEAR:
        if (room.state === GAME_STATE.DRAWING && room.currentDrawer === socket.id) {
          room.drawCommands = [];
          io.to(currentRoomId).emit('data', {
            id: PACKET.CLEAR
          });
        }
        break;
        
      case PACKET.UNDO:
        if (room.state === GAME_STATE.DRAWING && room.currentDrawer === socket.id) {
          // Undo logic would be implemented here
          socket.to(currentRoomId).emit('data', {
            id: PACKET.UNDO,
            data: data.data
          });
        }
        break;
        
      case PACKET.GUESS:
        if (room.state === GAME_STATE.DRAWING && socket.id !== room.currentDrawer) {
          // Anti-spam check for guesses (treat guesses as messages for spam detection)
          const spamResult = checkSpam(socket.id, data.data, room);
          if (spamResult.isSpam) {
            if (spamResult.shouldKick) {
              console.log(`[GUESS HANDLER] Player ${socket.id} should be kicked, returning early`);
              return; // Player was kicked, don't process the guess
            }
            if (spamResult.shouldWarn) {
              socket.emit('data', {
                id: PACKET.SPAM,
                data: null
              });
            }
            // Let the message through if not being kicked
          }
          
          if (!player.guessed) {
            // Normalize both guess and word by removing hyphens, spaces, and converting to lowercase
            const guess = data.data.toLowerCase().trim().replace(/-/g, '').replace(/\s+/g, '');
            const word = room.currentWord.toLowerCase().trim().replace(/-/g, '').replace(/\s+/g, '');
            
            if (guess === word) {
              const timeRemaining = room.timer;
              room.guessCount = (room.guessCount || 0) + 1;
              const guessPosition = room.guessCount;
              
              // Calculate guesser's score based on position (much higher now)
              // Store pending score - will be awarded at round end
              const guesserScore = calculateScore(timeRemaining, room.settings[SETTINGS.DRAWTIME], word.length, guessPosition);
              
              // Initialize pendingScores if it doesn't exist
              if (!room.pendingScores) {
                room.pendingScores = new Map();
              }
              
              // Store pending score for guesser (will be awarded at round end)
              if (!room.pendingScores.has(socket.id)) {
                room.pendingScores.set(socket.id, 0);
              }
              room.pendingScores.set(socket.id, room.pendingScores.get(socket.id) + guesserScore);
              
              player.guessed = true;
              
              // Store pending score for drawer (will be awarded at round end)
              const drawer = room.players.find(p => p.id === room.currentDrawer);
              if (drawer) {
                const drawerScore = calculateDrawerScore(guesserScore, guessPosition);
                if (!room.pendingScores.has(room.currentDrawer)) {
                  room.pendingScores.set(room.currentDrawer, 0);
                }
                room.pendingScores.set(room.currentDrawer, room.pendingScores.get(room.currentDrawer) + drawerScore);
              }
              
              // If first guess and timer > 32s and more than 2 players, drop timer to 32s
              if (guessPosition === 1 && room.timer > 32 && room.players.length > 2) {
                const oldTimer = room.timer;
                room.timer = 32;
                
                // If timer was above 44, first hint should already be revealed
                // Check if first hint should be shown (if we dropped from above 44)
                if (oldTimer > 44 && (!room.revealedIndices || room.revealedIndices.size === 0)) {
                  revealHint(room);
                }
                
                // Restart the timer interval with the new value
                if (room.timerInterval) {
                  clearInterval(room.timerInterval);
                  room.timerInterval = null;
                }
                startRoundTimer(room);
                
                // Restart hint system to continue monitoring for second hint at 25s
                if (room.hintInterval) {
                  clearInterval(room.hintInterval);
                  room.hintInterval = null;
                }
                startHintSystem(room);
              }
              
              // Send GUESS packet to show they guessed correctly, but don't update score yet
              io.to(currentRoomId).emit('data', {
                id: PACKET.GUESS,
                data: {
                  id: socket.id,
                  word: room.currentWord,
                  score: player.score  // Send current score (not updated yet)
                }
              });
              
              // Check if all players guessed
              const allGuessed = room.players.filter(p => p.id !== room.currentDrawer).every(p => p.guessed);
              if (allGuessed) {
                endRound(room, 0); // Everyone guessed
              }
            } else {
              // Check if close guess - exactly 1 letter difference (1 letter wrong, missing, or extra)
              const distance = levenshteinDistance(guess, word);
              const maxLength = Math.max(guess.length, word.length);
              // Consider "close" if Levenshtein distance is exactly 1
              if (distance === 1 && maxLength > 0) {
                socket.emit('data', {
                  id: PACKET.CLOSE,
                  data: data.data  // Send original guess (not lowercased) to preserve formatting
                });
                // Don't display in chat if it's a close guess (player sees "close" message instead)
              } else {
                // Wrong guess - display as chat message
                io.to(currentRoomId).emit('data', {
                  id: PACKET.CHAT,
                  data: {
                    id: socket.id,
                    msg: data.data
                  }
                });
              }
            }
          } else {
            // Player already guessed - just send as chat message
            io.to(currentRoomId).emit('data', {
              id: PACKET.CHAT,
              data: {
                id: socket.id,
                msg: data.data
              }
            });
          }
        }
        break;
        
      case PACKET.RATE:
        if (room.state === GAME_STATE.DRAWING) {
          // Broadcast to EVERYONE including the sender
          io.to(currentRoomId).emit('data', {
            id: PACKET.RATE,
            data: {
              id: socket.id,
              vote: data.data
            }
          });
        }
        break;
        
      case PACKET.CLAIM_REWARD:
        // Handle reward claim request. Address from: connected wallet (player.walletAddress) or user-entered (data.address)
        if (room.prizePoolFrozen && room.playerRewards) {
          const playerReward = room.playerRewards.get(socket.id);
          const player = room.players.find(p => p.id === socket.id);
          const userAddress = (data.data && typeof data.data === 'object' && data.data.address && typeof data.data.address === 'string') ? data.data.address.trim() : '';
          const claimAddress = (userAddress && userAddress.length > 0) ? userAddress : (player && player.walletAddress && player.walletAddress.trim()) ? player.walletAddress.trim() : null;
          const isValidSolanaAddress = (addr) => addr && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
          
          if (playerReward && playerReward > 0 && player && claimAddress && isValidSolanaAddress(claimAddress)) {
            if (room.claimedRewards && room.claimedRewards.has(socket.id)) {
              socket.emit('data', { id: PACKET.ERROR, data: 'Reward already claimed' });
              return;
            }
            sendSolToPlayer(claimAddress, playerReward, socket.id, room.id)
              .then((txSignature) => {
                if (!room.claimedRewards) room.claimedRewards = new Set();
                room.claimedRewards.add(socket.id);
                if (room.isPublic) leaderboardAddSolEarned(claimAddress, playerReward, player.name);
                socket.emit('data', {
                  id: PACKET.REWARD_CLAIMED,
                  data: { amount: playerReward, txSignature: txSignature, message: `Successfully claimed ${playerReward} SOL!` }
                });
                console.log(`✅ Player ${player.name} claimed ${playerReward} SOL to ${claimAddress.substring(0, 8)}... TX: ${txSignature}`);
              })
              .catch((error) => {
                console.error(`❌ Error sending SOL to ${player.name}:`, error);
                socket.emit('data', { id: PACKET.ERROR, data: `Failed to claim reward: ${error.message}` });
              });
          } else if (!player || !playerReward || playerReward <= 0) {
            socket.emit('data', { id: PACKET.ERROR, data: 'No reward available to claim' });
          } else if (!claimAddress || !isValidSolanaAddress(claimAddress)) {
            socket.emit('data', { id: PACKET.ERROR, data: 'Please connect your wallet or enter a valid Solana wallet address.' });
          }
        } else {
          socket.emit('data', { id: PACKET.ERROR, data: 'Game not finished or no rewards available' });
        }
        break;
        
      case PACKET.USE_REWARD_BUYBACK:
        // Use reward as buyback: either buy token via PumpPortal (if PUMPFUN_TOKEN_ADDRESS set) or send SOL to buyback wallet
        if (room.prizePoolFrozen && room.playerRewards) {
          const playerReward = room.playerRewards.get(socket.id);
          const player = room.players.find(p => p.id === socket.id);
          const tokenMint = (FEE_DISTRIBUTION_CONFIG.PUMPFUN_TOKEN_ADDRESS || '').trim();
          const buybackWallet = (FEE_DISTRIBUTION_CONFIG.BUYBACK_WALLET_ADDRESS || FEE_DISTRIBUTION_CONFIG.CREATOR_WALLET || '').trim();
          if (!tokenMint && !buybackWallet) {
            socket.emit('data', { id: PACKET.ERROR, data: 'Buyback is not configured.' });
            return;
          }
          if (playerReward && playerReward > 0 && player) {
            if (room.claimedRewards && room.claimedRewards.has(socket.id)) {
              socket.emit('data', { id: PACKET.ERROR, data: 'Reward already claimed' });
              return;
            }
            const doBuyback = tokenMint
              ? () => executeBuybackWithPumpPortal(playerReward, socket.id, room.id)
              : () => sendSolToPlayer(buybackWallet, playerReward, socket.id, room.id);
            doBuyback()
              .then((txSignature) => {
                if (!room.claimedRewards) room.claimedRewards = new Set();
                room.claimedRewards.add(socket.id);
                socket.emit('data', {
                  id: PACKET.REWARD_CLAIMED,
                  data: {
                    amount: playerReward,
                    txSignature: txSignature,
                    message: tokenMint ? `Bought token with ${playerReward} SOL!` : `Sent ${playerReward} SOL to buyback!`,
                    buyback: true
                  }
                });
                console.log(`✅ Player ${player.name} used ${playerReward} SOL as buyback. TX: ${txSignature}`);
              })
              .catch((error) => {
                console.error(`❌ Buyback error for ${player.name}:`, error);
                socket.emit('data', { id: PACKET.ERROR, data: `Failed buyback: ${error.message}` });
              });
          } else if (!playerReward || playerReward <= 0) {
            socket.emit('data', { id: PACKET.ERROR, data: 'No reward available' });
          }
        } else {
          socket.emit('data', { id: PACKET.ERROR, data: 'Game not finished or no rewards available' });
        }
        break;
        
      case PACKET.CHAT:
        // Handle chat messages (packet id 30)
        // Block links in chat messages - any 2+ letter word followed by a dot and anything
        // data.data is the message string directly
        const message = String(data.data || '').trim();
        
        // Comprehensive link pattern: catches any 2+ alphanumeric chars, dot, then any chars
        // This catches: example.com, test.io, abc.xyz, www.test.com, http://test.com, https://test.com, etc.
        // Also catches patterns like "go to example.com" or "check test.io"
        // Pattern breakdown:
        // - [a-zA-Z0-9]{2,}\.[a-zA-Z0-9.-]+ : matches "example.com", "test.io", etc.
        // - https?:\/\/[^\s]+ : matches "http://..." or "https://..."
        // - www\.[a-zA-Z0-9.-]+ : matches "www.example.com"
        const linkPattern = /([a-zA-Z0-9]{2,}\.[a-zA-Z0-9.-]+|https?:\/\/[^\s]+|www\.[a-zA-Z0-9.-]+)/i;
        
        // Check for links BEFORE processing the message
        // Silently block links - don't send error message, just don't send the message
        if (linkPattern.test(message)) {
          console.log(`[LINK BLOCK] ⛔ Silently blocked link in message from ${socket.id}: "${message}"`);
          return; // Don't send the message - exit early (no error message, no kick)
        }
        // Anti-spam check
        const spamResult = checkSpam(socket.id, message, room);
        if (spamResult.isSpam) {
          if (spamResult.shouldKick) {
            // Kick should have already been called in checkSpam, just return
            // DO NOT show any warning message when kicking
            return; // Player was kicked, don't process the chat message
          }
          // Only show warning if we're NOT kicking
          if (spamResult.shouldWarn && !spamResult.shouldKick) {
            socket.emit('data', {
              id: PACKET.SPAM,
              data: null
            });
          }
          // Let the message through if not being kicked
        }
        
        if (room.state === GAME_STATE.DRAWING || room.state === GAME_STATE.WORD_CHOICE) {
          if (socket.id === room.currentDrawer) {
            // Drawer's chat during drawing or word choice - send to drawer and all players who have guessed
            // First send to drawer
            socket.emit('data', {
              id: PACKET.CHAT,
              data: {
                id: socket.id,
                msg: data.data
              }
            });
            // Also send to all players who have guessed
            room.players.forEach(p => {
              if (p.id !== socket.id && p.guessed) {
                const playerSocket = io.sockets.sockets.get(p.id);
                if (playerSocket) {
                  playerSocket.emit('data', {
                    id: PACKET.CHAT,
                    data: {
                      id: socket.id,
                      msg: data.data
                    }
                  });
                }
              }
            });
          } else {
            // Regular chat during drawing/word choice - guessing players can chat normally
            io.to(currentRoomId).emit('data', {
              id: PACKET.CHAT,
              data: {
                id: socket.id,
                msg: data.data
              }
            });
          }
        } else {
          // Allow chat in all other states (LOBBY, ROUND_START, ROUND_END, GAME_END)
          io.to(currentRoomId).emit('data', {
            id: PACKET.CHAT,
            data: {
              id: socket.id,
              msg: data.data
            }
          });
        }
        break;
        
      case PACKET.KICK:
        if (room.owner === socket.id && data.data !== socket.id) {
          const targetPlayer = room.players.find(p => p.id === data.data);
          if (targetPlayer) {
            kickPlayer(room, data.data, 1);
            // Message is sent from kickPlayer function
          }
        }
        break;
        
      case PACKET.BAN:
        if (room.owner === socket.id && data.data !== socket.id) {
          kickPlayer(room, data.data, 2);
          // Message is sent from kickPlayer function
        }
        break;
        
      case PACKET.MUTE:
        // Mute is client-side only (just filters chat), but we can track it server-side if needed
        // For now, just acknowledge it
        break;
        
      case PACKET.VOTEKICK:
        handleVotekick(room, socket.id, data.data);
        break;
        
      case PACKET.REPORT:
        // Reports are handled client-side only
        break;
        
      default:
        console.log(`⚠️ Unknown packet ID: ${data.id}`);
        break;
    }
    } catch (error) {
      console.error(`❌ Error handling packet ${data.id} from ${socket.id}:`, error);
      console.error('Stack:', error.stack);
      // Don't crash - just log the error
    }
  });
  
  socket.on('disconnect', () => {
    // Clean up spam tracker
    spamTracker.delete(socket.id);
    // Free wallet so it can be used in another tab/session
    if (player && player.walletAddress) {
      const w = player.walletAddress.trim();
      if (walletToSocketId.get(w) === socket.id) {
        walletToSocketId.delete(w);
      }
    }
    
    if (player && currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        // Remove player
        const index = room.players.findIndex(p => p.id === socket.id);
        if (index !== -1) {
          const leavingPlayer = room.players[index];
          const wasDrawer = room.currentDrawer === socket.id;
          const wasInWordChoice = room.state === GAME_STATE.WORD_CHOICE;
          room.players.splice(index, 1);
            
            // For public rooms in LOBBY state, if players drop below 8, the game won't start
            // (Games only start with exactly 8 players, so no need to cancel timer)
            // If game is running and players leave, they continue - new players go to waiting lobbies
          
          // If drawer left during WORD_CHOICE, move to next drawer and restart timer
          if (wasDrawer && wasInWordChoice) {
            // Clear word choice timer
            if (room.wordChoiceTimer) {
              clearInterval(room.wordChoiceTimer);
              room.wordChoiceTimer = null;
            }
            
            // Check if there are enough players left
            // Game continues until only 1 player left (then show podium if mid-game, or stay in lobby if already in lobby)
            if (room.players.length < 2) {
              // Only 1 player left - if mid-game, show podium; if in lobby, stay in lobby
              if (room.state === GAME_STATE.LOBBY) {
                // Already in lobby - stay in lobby (waiting for players)
                console.log(`⏸️ Only 1 player left in LOBBY state in room ${currentRoomId}, staying in lobby`);
                io.to(currentRoomId).emit('data', {
                  id: PACKET.STATE,
                  data: {
                    id: GAME_STATE.LOBBY,
                    time: 0,
                    data: {}
                  }
                });
              } else {
                // Mid-game - show podium (they win)
                console.log(`🏆 Only 1 player left mid-game in room ${currentRoomId}, showing podium`);
                // Clear all timers
                if (room.timerInterval) {
                  clearInterval(room.timerInterval);
                  room.timerInterval = null;
                }
                if (room.hintInterval) {
                  clearInterval(room.hintInterval);
                  room.hintInterval = null;
                }
                if (room.wordChoiceTimer) {
                  clearInterval(room.wordChoiceTimer);
                  room.wordChoiceTimer = null;
                }
                endGame(room);
              }
            } else {
              // 2+ players left - game continues
              // Move to next drawer using round robin (same logic as startRound)
              // Since the drawer left, we need to recalculate based on current round
              const drawerIndex = (room.currentRound - 1) % room.players.length;
              room.currentDrawer = room.players[drawerIndex].id;
              
              // Restart word choice with new drawer
              const words = room.currentWords || getRandomWords(
                room.settings[SETTINGS.LANG],
                room.settings[SETTINGS.WORDCOUNT],
                room.customWords,
                room.settings[SETTINGS.CUSTOMWORDSONLY] === 1
              );
              sendWordChoice(room, words);
            }
          }
          
          // If drawer left, end round (only if actually in DRAWING state)
          // But only if we have 2+ players - if only 1 player left, show podium if mid-game, or stay in lobby
          if (wasDrawer && room.state === GAME_STATE.DRAWING) {
            if (room.players.length < 2) {
              // Only 1 player left - if mid-game, show podium; if in lobby, stay in lobby
              console.log(`🏆 Drawer left, only 1 player remaining mid-game in room ${currentRoomId}, showing podium`);
              // Clear all timers
              if (room.timerInterval) {
                clearInterval(room.timerInterval);
                room.timerInterval = null;
              }
              if (room.hintInterval) {
                clearInterval(room.hintInterval);
                room.hintInterval = null;
              }
              if (room.wordChoiceTimer) {
                clearInterval(room.wordChoiceTimer);
                room.wordChoiceTimer = null;
              }
              // Show podium (they win)
              endGame(room);
            } else {
              // 2+ players left - continue game, end round and move to next drawer
            endRound(room, 1); // Drawer left
            }
          }
          
          // Handle ownership transfer (only for private rooms - public rooms have no owner)
          if (room.owner === socket.id && !room.isPublic) {
            if (room.players.length > 0) {
              // Transfer to first remaining player
            room.owner = room.players[0].id;
              
              // If it's a private room with only 1 player, handle separately (below)
              // Otherwise, handle normal ownership transfer
              if (room.players.length === 1 && !room.isPublic) {
                // Single player case - handled below to avoid duplicate messages
              } else {
                // Multiple players - send owner change notification
                const sendOwnerChange = () => {
            io.to(currentRoomId).emit('data', {
              id: PACKET.OWNER,
              data: room.owner
            });
                };
          
                // If it's a private room, return to lobby (settings screen)
                // Public rooms don't have owners, so this only applies to private rooms
                if (!room.isPublic) {
                  // For private rooms, check if we should return to lobby or show podium
                  if (room.state === GAME_STATE.LOBBY) {
                    // Already in lobby - just send owner change, don't reset state
                    sendOwnerChange();
                  } else {
                    // Mid-game - check if only 1 player left
                    if (room.players.length === 1) {
                      // Only 1 player left mid-game - show podium
                      console.log(`🏆 Owner left, only 1 player remaining mid-game in private room ${currentRoomId}, showing podium`);
                      // Clear all timers
                      if (room.timerInterval) {
                        clearInterval(room.timerInterval);
                        room.timerInterval = null;
                      }
                      if (room.hintInterval) {
                        clearInterval(room.hintInterval);
                        room.hintInterval = null;
                      }
                      if (room.wordChoiceTimer) {
                        clearInterval(room.wordChoiceTimer);
                        room.wordChoiceTimer = null;
                      }
                      endGame(room);
                      sendOwnerChange();
                    } else {
                      // Multiple players - return to lobby (settings screen) for private rooms
                      // Reset room state to lobby
                      room.state = GAME_STATE.LOBBY;
                      room.currentRound = 0;
                      room.currentDrawer = -1;
                      room.currentWord = '';
                      room.timer = 0;
                      // Clear any active timers
                      if (room.timerInterval) {
                        clearInterval(room.timerInterval);
                        room.timerInterval = null;
                      }
                      if (room.hintInterval) {
                        clearInterval(room.hintInterval);
                        room.hintInterval = null;
                      }
                      if (room.wordChoiceTimer) {
                        clearInterval(room.wordChoiceTimer);
                        room.wordChoiceTimer = null;
                      }
                      // Reset player scores and guessed status
                      room.players.forEach(p => {
                        p.score = 0;
                        p.guessed = false;
                      });
                      
                      // Send LOBBY state to all players (returns to settings screen)
                      setTimeout(() => {
                        io.to(currentRoomId).emit('data', {
                          id: PACKET.STATE,
                          data: {
                            id: GAME_STATE.LOBBY,
                            time: 0,
                            data: {}
                          }
                        });
                      }, 50);
                      
                      // Delay owner change slightly to avoid spam detection
                      setTimeout(sendOwnerChange, 100);
                    }
                  }
                } else {
                  // Public rooms don't have owners, so just continue
                  // (This shouldn't happen for public rooms, but just in case)
                }
              }
            } else {
              // Room is now empty - if it was a private room, clean it up
              // Public rooms will be cleaned up below
              if (!room.isPublic) {
                rooms.delete(currentRoomId);
              }
            }
          }
          
          // Broadcast leave with player name
          socket.to(currentRoomId).emit('data', {
            id: PACKET.LEAVE,
            data: {
              id: socket.id,
              reason: 0,
              name: leavingPlayer ? leavingPlayer.name : 'User'
            }
          });
          
          // If room is now empty (or only 1 player in a private room), handle cleanup
          if (room.players.length === 0) {
            // Room is empty - delete it
            rooms.delete(currentRoomId);
            console.log('🗑️ Room deleted (empty):', currentRoomId);
          } else if (room.players.length === 1) {
            // Only 1 player left - behavior depends on game state and room type
            const remainingPlayer = room.players[0];
            
            // For public rooms, ALWAYS kick the last player back to home (regardless of state)
            if (room.isPublic) {
              console.log(`🏠 Only 1 player left in public room ${currentRoomId}, kicking them back to home (lobby is empty)`);
              
              // Get the remaining player's socket
              const remainingPlayerSocket = io.sockets.sockets.get(remainingPlayer.id);
              if (remainingPlayerSocket) {
                // Clear any active timers before removing player
                if (room.timerInterval) {
                  clearInterval(room.timerInterval);
                  room.timerInterval = null;
                }
                if (room.hintInterval) {
                  clearInterval(room.hintInterval);
                  room.hintInterval = null;
                }
                if (room.wordChoiceTimer) {
                  clearInterval(room.wordChoiceTimer);
                  room.wordChoiceTimer = null;
                }
                if (room.autoStartTimer) {
                  clearTimeout(room.autoStartTimer);
                  room.autoStartTimer = null;
                }
                
                // CRITICAL: Send reason event FIRST (similar to kick/ban)
                // Reason codes: 1 = kicked, 2 = banned, 3 = lobby empty
                remainingPlayerSocket.emit('reason', 3);
                
                // Remove player from room BEFORE disconnecting
                const playerIndex = room.players.findIndex(p => p.id === remainingPlayer.id);
                if (playerIndex !== -1) {
                  room.players.splice(playerIndex, 1);
                }
                
                // Clean up player data
                players.delete(remainingPlayer.id);
                remainingPlayerSocket.leave(currentRoomId);
                
                // Delete the empty room
                rooms.delete(currentRoomId);
                console.log('🗑️ Public lobby deleted (empty):', currentRoomId);
                
                // Disconnect the socket to ensure they're kicked (same as kick/ban)
                setTimeout(() => {
                  remainingPlayerSocket.disconnect(true);
                }, 100); // Small delay to ensure reason event is processed
              }
              return; // Don't continue with other logic - CRITICAL to prevent podium screen
            }
            
            // Make the remaining player the new owner (for private rooms only)
            if (!room.isPublic) {
              room.owner = remainingPlayer.id;
            }
            
            // If in LOBBY state (waiting for players), stay in LOBBY
            if (room.state === GAME_STATE.LOBBY) {
              console.log(`⏸️ Only 1 player left in LOBBY state in room ${currentRoomId}, staying in lobby (waiting for players)`);
              // Clear any active timers to prevent countdown
              if (room.timerInterval) {
                clearInterval(room.timerInterval);
                room.timerInterval = null;
              }
              if (room.hintInterval) {
                clearInterval(room.hintInterval);
                room.hintInterval = null;
              }
              if (room.wordChoiceTimer) {
                clearInterval(room.wordChoiceTimer);
                room.wordChoiceTimer = null;
              }
              // Set timer to 0 and ensure it stays at 0
              room.timer = 0;
              // For private rooms, send owner change
              if (!room.isPublic) {
                io.to(remainingPlayer.id).emit('data', {
                  id: PACKET.OWNER,
                  data: room.owner
                });
              }
              // Stay in LOBBY state - don't change anything, just ensure state is sent
              io.to(currentRoomId).emit('data', {
                id: PACKET.STATE,
                data: {
                  id: GAME_STATE.LOBBY,
                  time: 0,
                  data: {}
                }
              });
              
              // CRITICAL: For public rooms, also send GAME_DATA after STATE to ensure waiting screen (not settings)
              if (room.isPublic) {
                setTimeout(() => {
                  room.players.forEach(p => {
                    const gameData = {
                      me: p.id,
                      type: 0,
                      id: room.id,
                      users: room.players.map(pl => ({
                        id: pl.id,
                        name: pl.name,
                        avatar: pl.avatar,
                        score: pl.score,
                        guessed: pl.guessed === true ? true : false,
                        flags: pl.flags
                      })),
                      round: room.state === GAME_STATE.LOBBY ? 0 : (room.currentRound > 0 ? room.currentRound - 1 : 0), // Send 0-indexed round
                      owner: null,
                      settings: room.settings,
                      state: {
                        id: room.state,
                        time: 0,
                        data: {}
                      },
                      isPublic: true
                    };
                    io.to(p.id).emit('data', {
                      id: PACKET.GAME_DATA,
                      data: gameData
                    });
                  });
                }, 50);
              }
              // Send TIMER packet to ensure timer displays 0 (no countdown)
              io.to(currentRoomId).emit('data', {
                id: PACKET.TIMER,
                data: 0
              });
            } else {
              // Mid-game: show podium screen (GAME_END) - the remaining player wins
              console.log(`🏆 Only 1 player left mid-game in room ${currentRoomId}, showing podium (they win)`);
              
              // Clear any active timers
              if (room.timerInterval) {
                clearInterval(room.timerInterval);
                room.timerInterval = null;
              }
              if (room.hintInterval) {
                clearInterval(room.hintInterval);
                room.hintInterval = null;
              }
              if (room.wordChoiceTimer) {
                clearInterval(room.wordChoiceTimer);
                room.wordChoiceTimer = null;
              }
              
              // End the game and show podium
              endGame(room);
            }
          }
        }
      }
      players.delete(socket.id);
    }
  });
  
  function startGame(room) {
    // Check minimum players requirement
    // Public rooms need exactly 8 players, private rooms need 2+
    const minPlayers = room.isPublic ? 8 : 2;
    if (room.players.length < minPlayers) {
      if (room.isPublic) {
        // For public rooms, just return - game will auto-start when exactly 8 players join
        return;
      } else {
        // Notify owner that minimum players are required
        if (room.owner) {
      io.to(room.owner).emit('data', {
        id: PACKET.CLOSE,
            data: `Minimum ${minPlayers} players required to start the game!`
      });
        }
      return;
      }
    }
    
    // For public rooms, ensure we have exactly 8 players
    if (room.isPublic && room.players.length !== 8) {
      console.log(`⚠️ Public room ${room.id} has ${room.players.length} players, need exactly 8`);
      return;
    }
    
    // Reset round to 0, then startRound will increment to 1 for the first round
    room.currentRound = 0;
    room.players.forEach(p => {
      p.score = 0;
      p.guessed = false;
      p.roundStartScore = 0;  // Initialize round start score
    });
    // Initialize pending scores map
    room.pendingScores = new Map();
    // Mark game as started (active lobby for prize pool distribution)
    room.gameStarted = true;
    console.log('🎮 Starting game in room', room.id, 'currentRound reset to 0');
    // Apply small point head-start for top 50 token holders (then start first round)
    applyHolderBonuses(room).then(() => startRound(room)).catch((err) => {
      console.warn('Holder bonus error, starting round anyway:', err.message);
      startRound(room);
    });
  }
  
  function startRound(room) {
    room.currentRound++;
    console.log(`🔄 Starting round ${room.currentRound} in room ${room.id}`);
    if (room.currentRound > room.settings[SETTINGS.ROUNDS]) {
      // Game end
      endGame(room);
      return;
    }
    
    // Select drawer (round robin)
    const drawerIndex = (room.currentRound - 1) % room.players.length;
    room.currentDrawer = room.players[drawerIndex].id;
    console.log(`🎨 Drawer for round ${room.currentRound}: ${room.currentDrawer} (index ${drawerIndex})`);
    console.log(`🎨 All players in room:`, room.players.map(p => ({ id: p.id, name: p.name })));
    console.log(`🎨 Drawer player:`, room.players[drawerIndex] ? { id: room.players[drawerIndex].id, name: room.players[drawerIndex].name } : 'NOT FOUND');
    // Store scores at round start to calculate round score later
    room.players.forEach(p => {
      p.guessed = false;
      p.roundStartScore = p.score;  // Track score at round start
    });
    // Reset guess counter for position tracking
    room.guessCount = 0;
    // Initialize pending scores map for this round
    room.pendingScores = new Map();
    
    // Select words
    const words = getRandomWords(
      room.settings[SETTINGS.LANG],
      room.settings[SETTINGS.WORDCOUNT],
      room.customWords,
      room.settings[SETTINGS.CUSTOMWORDSONLY] === 1
    );
    
    // Send ROUND_START state to show "Round X" overlay; include users so holder bonus scores show immediately
    const roundNumber = room.currentRound - 1; // Round number (0-indexed, client adds 1 to display)
    const roundStartData = {
      round: roundNumber,
      users: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        guessed: p.guessed,
        flags: p.flags || 0
      }))
    };
    io.to(room.id).emit('data', {
      id: PACKET.STATE,
      data: {
        id: GAME_STATE.ROUND_START, // F = 2
        time: 0,
        data: roundStartData
      }
    });
    
    // Send word choice with a small delay to ensure ROUND_START is processed first
    // This is especially important for the first round
    setTimeout(() => {
      sendWordChoice(room, words);
    }, 100);
  }
  
  function sendWordChoice(room, words) {
    // Validate words array
    if (!words || !Array.isArray(words) || words.length === 0) {
      console.error(`❌ ERROR: Invalid words array in sendWordChoice:`, words);
      return;
    }
    
    room.state = GAME_STATE.WORD_CHOICE;
    room.timer = 15; // 15 second timer for word choice
    room.currentWords = words; // Store words in room for timer access
    
    // Validate drawer exists
    if (!room.currentDrawer || room.currentDrawer === -1) {
      console.error(`❌ ERROR: Invalid drawer in sendWordChoice:`, room.currentDrawer);
      return;
    }
    
    // Send word choice to DRAWER (V = 3, WORD_CHOICE with words and timer)
    console.log(`📤 Sending WORD_CHOICE to DRAWER ${room.currentDrawer} with ${words.length} words:`, words);
    console.log(`📤 Drawer socket exists:`, io.sockets.sockets.has(room.currentDrawer));
    const drawerPacket = {
      id: PACKET.STATE,
      data: {
        id: GAME_STATE.WORD_CHOICE, // V = 3
        time: room.timer, // 15 seconds for word choice
        data: {
          words: words
        }
      }
    };
    console.log(`📤 Drawer packet structure:`, JSON.stringify(drawerPacket, null, 2));
    io.to(room.currentDrawer).emit('data', drawerPacket);
    
    // Send "choosing word" message to OTHER players (V = 3, WORD_CHOICE without words, with timer)
    // Also send drawer's name and avatar to ensure correct display
    const drawerPlayer = room.players.find(p => p.id === room.currentDrawer);
    if (!drawerPlayer) {
      console.error(`❌ ERROR: Drawer ${room.currentDrawer} not found in room ${room.id}! Players:`, room.players.map(p => p.id));
      return; // Don't proceed if drawer not found
    }
    
    // Reference code only sends drawer ID, client looks up player from player list
    room.players.forEach(player => {
      if (player.id !== room.currentDrawer) {
        // Always send drawer data, even if invalid (client will handle fallback)
        // Reference code: bn() receives state object with e.id = state ID, e.data.id = drawer ID
        // Structure: { id: PACKET.STATE, data: { id: GAME_STATE.WORD_CHOICE, data: { id: drawerId } } }
        // But actually, looking at the code, bn() switches on e.id which is the state ID
        // And in case V, it uses e.data.id for the drawer ID
        // So we need: data.id = state ID, and data.data.id = drawer ID? No wait...
        // Actually, sa() receives the state data, and bn() receives that same object
        // So if sa() receives { id: WORD_CHOICE, data: {...} }, then bn() gets the same
        // In bn(), e.id = WORD_CHOICE, and e.data.id should be the drawer ID
        const wordChoiceData = {
          id: PACKET.STATE,
          data: {
            id: GAME_STATE.WORD_CHOICE, // State ID for bn() switch
            time: room.timer,
            data: {
              id: room.currentDrawer  // Drawer ID only (reference code: W(e.data.id))
            }
          }
        };
        console.log(`📤 Sending WORD_CHOICE to ${player.id} (non-drawer) with drawer ID:`, room.currentDrawer);
        console.log(`📤 Non-drawer packet structure:`, JSON.stringify(wordChoiceData, null, 2));
        io.to(player.id).emit('data', wordChoiceData);
      }
    });
    
    // Start word choice timer (15 seconds)
    if (room.wordChoiceTimer) {
      clearInterval(room.wordChoiceTimer);
    }
    room.wordChoiceTimer = setInterval(() => {
      room.timer--;
      
      // Send timer update to all players
      io.to(room.id).emit('data', {
        id: PACKET.TIMER,
        data: room.timer
      });
      
      if (room.timer <= 0) {
        // Time's up - auto-select first word
        clearInterval(room.wordChoiceTimer);
        room.wordChoiceTimer = null;
        
        if (room.currentWords && room.currentWords.length > 0) {
          room.currentWord = room.currentWords[0];
          room.state = GAME_STATE.DRAWING;
          room.timer = room.settings[SETTINGS.DRAWTIME];
          room.startTime = Date.now();
          room.drawCommands = [];
          room.hintIndex = 0;
          room.hintInterval = null;
          room.revealedIndices = new Set(); // Track which letter positions have been revealed
          
          // Start drawing timer
          startRoundTimer(room);
          
          // Start hint system (always enabled, reveals at 44s and 25s)
          startHintSystem(room);
          
          // Send DRAWING state - drawer gets word, others don't
          // Send to drawer with word
          io.to(room.currentDrawer).emit('data', {
            id: PACKET.STATE,
            data: {
              id: GAME_STATE.DRAWING, // j = 4
              time: room.timer,
              data: {
                id: room.currentDrawer,
                word: room.currentWord, // Drawer sees the word
                hints: [],
                drawCommands: []
              }
            }
          });
          
          // Send to other players without word (but send word length for display)
          room.players.forEach(player => {
            if (player.id !== room.currentDrawer) {
              io.to(player.id).emit('data', {
                id: PACKET.STATE,
                data: {
                  id: GAME_STATE.DRAWING, // j = 4
                  time: room.timer,
                  data: {
                    id: room.currentDrawer,
                    word: undefined, // Others don't see the word
                    wordLength: room.currentWord ? room.currentWord.length : 0, // Send word length for underscore display
                    wordStructure: room.currentWord ? room.currentWord.replace(/[^\s\-]/g, '_') : undefined, // Send word structure with underscores, preserving spaces and dashes
                    hints: [],
                    drawCommands: []
                  }
                }
              });
            }
          });
        }
      }
    }, 1000);
  }
  
  function startRoundTimer(room) {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
    }
    
    room.timerInterval = setInterval(() => {
      room.timer--;
      
      io.to(room.id).emit('data', {
        id: PACKET.TIMER,
        data: room.timer
      });
      
      if (room.timer <= 0) {
        endRound(room, 2); // Time up
      }
    }, 1000);
  }
  
  function revealHint(room) {
    if (room.state !== GAME_STATE.DRAWING) return;
    
    const word = room.currentWord;
    if (!word || !room.revealedIndices) return;
    
    // Find a random unrevealed letter (skip spaces and dashes)
    let index;
    let attempts = 0;
    do {
      index = Math.floor(Math.random() * word.length);
      attempts++;
      if (attempts > 100) return; // Safety check
      // Skip spaces and dashes - only reveal actual letters
    } while ((room.revealedIndices.has(index) || word.charAt(index) === ' ' || word.charAt(index) === '-') && room.revealedIndices.size < word.replace(/[\s\-]/g, '').length);
    
    room.revealedIndices.add(index);
    const character = word.charAt(index);
    
    // Send hint to all non-drawers
    io.to(room.id).emit('data', {
      id: PACKET.HINTS,
      data: [[index, character]]
    });
  }
  
  function startHintSystem(room) {
    if (room.hintInterval) {
      clearInterval(room.hintInterval);
    }
    
    // Initialize revealed indices if not exists
    if (!room.revealedIndices) {
      room.revealedIndices = new Set();
    }
    
    const word = room.currentWord;
    if (!word) return;
    
    // Get hint count from settings (default to 2)
    const hintCount = room.settings[SETTINGS.HINTCOUNT] || 2;
    
    // First hint at 44 seconds, second at 25 seconds
    // Then show remaining hints (hintCount - 2) evenly distributed after 25s
    const totalHints = hintCount;
    const hintsAfter25s = Math.max(0, totalHints - 2); // Remaining hints after the first 2
    const drawTime = room.settings[SETTINGS.DRAWTIME] || 80;
    
    // Calculate intervals for hints after 25s
    // Split the remaining time (25 seconds) evenly across the remaining hints
    let hintTimesAfter25s = [];
    if (hintsAfter25s > 0 && drawTime > 25) {
      const timeAfter25s = 25; // Time from 25s to 0s
      const interval = timeAfter25s / (hintsAfter25s + 1); // +1 to space them out
      for (let i = 1; i <= hintsAfter25s; i++) {
        hintTimesAfter25s.push(Math.floor(25 - (interval * i)));
      }
      hintTimesAfter25s.sort((a, b) => b - a); // Sort descending (highest first)
    }
    
    // Check hints based on timer remaining (not intervals)
    room.hintInterval = setInterval(() => {
      if (room.state !== GAME_STATE.DRAWING) {
        clearInterval(room.hintInterval);
        room.hintInterval = null;
        return;
      }
      
      const timeRemaining = room.timer;
      const currentWord = room.currentWord;
      
      if (!currentWord || currentWord !== word) {
        clearInterval(room.hintInterval);
        room.hintInterval = null;
        return;
      }
      
      // First hint at 44 seconds remaining (only if no hints revealed yet)
      if (timeRemaining === 44 && room.revealedIndices.size === 0) {
        revealHint(room);
      }
      
      // Second hint at 25 seconds remaining (only if exactly 1 hint has been revealed)
      if (timeRemaining === 25 && room.revealedIndices.size === 1 && totalHints >= 2) {
        revealHint(room);
      }
      
      // Show remaining hints after 25s at calculated intervals
      if (timeRemaining < 25 && hintsAfter25s > 0) {
        const revealedAfter25s = room.revealedIndices.size - 2; // Hints revealed after the first 2
        if (revealedAfter25s >= 0 && revealedAfter25s < hintsAfter25s) {
          const targetTime = hintTimesAfter25s[revealedAfter25s];
          if (timeRemaining === targetTime || (timeRemaining < targetTime && timeRemaining >= targetTime - 1)) {
            revealHint(room);
          }
        }
      }
      
      // Also check if we're past 44 and no hint revealed yet (catch edge cases)
      if (timeRemaining < 44 && timeRemaining >= 25 && room.revealedIndices.size === 0) {
        revealHint(room);
      }
      
      // Clean up if max hints are revealed or timer is past hint times
      if (room.revealedIndices.size >= totalHints || timeRemaining <= 0) {
        clearInterval(room.hintInterval);
        room.hintInterval = null;
      }
    }, 1000); // Check every second
  }
  
  function endRound(room, reason) {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
    
    if (room.hintInterval) {
      clearInterval(room.hintInterval);
      room.hintInterval = null;
    }
    
    if (room.wordChoiceTimer) {
      clearInterval(room.wordChoiceTimer);
      room.wordChoiceTimer = null;
    }
    
    room.state = GAME_STATE.ROUND_END;
    // Clear current drawer when round ends to prevent false "drawer left" messages
    room.currentDrawer = -1;
    
    // Award all pending scores from this round
    if (room.pendingScores) {
      room.pendingScores.forEach((pendingScore, playerId) => {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
          player.score += pendingScore;
        }
      });
      // Clear pending scores for next round
      room.pendingScores.clear();
    }
    
    // Calculate scores: [playerId, totalScore, roundScore]
    // roundScore is the delta for this round (shown with + prefix)
    const scores = [];
    room.players.forEach(p => {
      const roundScore = p.score - (p.roundStartScore || 0);
      scores.push(p.id, p.score, roundScore);
    });
    
    // Check if this is the final round
    const isFinalRound = room.currentRound >= room.settings[SETTINGS.ROUNDS];
    
    if (isFinalRound) {
      // Final round - go to game end (which shows the podium)
      endGame(room);
    } else {
      // Regular round - just wait 5 seconds then start next round (no podium)
      // Send a brief round end state without showing full podium
      io.to(room.id).emit('data', {
        id: PACKET.STATE,
        data: {
          id: GAME_STATE.ROUND_END,
          time: 0,
          data: {
            word: room.currentWord,
            reason: reason,
            scores: scores
          }
        }
      });
      
      // Wait 3 seconds, then start next round
      setTimeout(() => {
        startRound(room);
      }, 3000);
    }
  }
  
  function endGame(room) {
    room.state = GAME_STATE.GAME_END;
    // Freeze prize pool when game ends - this is the claimable amount for winners
    room.prizePoolFrozen = true;
    console.log(`💰 Prize pool frozen for room ${room.id}: ${room.prizePool} SOL`);
    
    const rankings = room.players
      .map(p => [p.id, 0, ''])
      .sort((a, b) => {
        const playerA = room.players.find(p => p.id === a[0]);
        const playerB = room.players.find(p => p.id === b[0]);
        return (playerB?.score || 0) - (playerA?.score || 0);
      });
    
    // Assign ranks, handling ties (players with same score get same rank)
    let currentRank = 0;
    let previousScore = null;
    rankings.forEach((rank, index) => {
      const player = room.players.find(p => p.id === rank[0]);
      const currentScore = player?.score || 0;
      
      // If this player has a different score than the previous one, update the rank
      if (previousScore !== null && currentScore !== previousScore) {
        currentRank = index;
      }
      // If this is the first player, rank is 0
      if (previousScore === null) {
        currentRank = 0;
      }
      
      rank[1] = currentRank;
      previousScore = currentScore;
    });
    
    // Calculate and store player rewards based on rankings
    // Distribution: 1st place gets 50%, 2nd gets 30%, 3rd gets 20%
    if (!room.playerRewards) {
      room.playerRewards = new Map();
    }
    
    const totalPrizePool = room.prizePool;
    if (totalPrizePool > 0) {
      // Group players by rank (handle ties)
      const playersByRank = new Map();
      rankings.forEach((rank, index) => {
        const rankNum = rank[1];
        if (!playersByRank.has(rankNum)) {
          playersByRank.set(rankNum, []);
        }
        playersByRank.get(rankNum).push(rank[0]);
      });
      
      // Distribute rewards (1st 50%, 2nd 30%, 3rd 20%). Ties split that place's share equally (e.g. 2-way tie for 1st = 50/50 = 25% each).
      const rewardPercentages = [0.5, 0.3, 0.2]; // 1st, 2nd, 3rd place percentages
      let rankIndex = 0;
      
      for (const [rankNum, playerIds] of playersByRank.entries()) {
        if (rankIndex < rewardPercentages.length) {
          const percentage = rewardPercentages[rankIndex];
          const rewardPerPlayer = (totalPrizePool * percentage) / playerIds.length; // Split equally among tied players
          
          playerIds.forEach(playerId => {
            const existingReward = room.playerRewards.get(playerId) || 0;
            room.playerRewards.set(playerId, existingReward + rewardPerPlayer);
            const player = room.players.find(p => p.id === playerId);
            if (player) {
              console.log(`💰 Player ${player.name} (rank ${rankNum + 1}) reward: ${rewardPerPlayer} SOL`);
            }
          });
          
          rankIndex++;
        }
      }
    }
    
    // Set timer to 7 seconds for countdown in top-left clock
    room.timer = 7;
    
    // Include prize pool and player rewards in game end data
    const gameEndData = {
      rankings: rankings,
      prizePool: room.prizePool,
      playerRewards: {} // Map player IDs to their reward amounts
    };
    
    // Add player rewards to the data
    if (room.playerRewards) {
      room.playerRewards.forEach((reward, playerId) => {
        gameEndData.playerRewards[playerId] = reward;
      });
    }
    
    // Update global leaderboard from this public game only (all-time points + latest name)
    leaderboardUpdateFromPublicGame(room);
    
    io.to(room.id).emit('data', {
      id: PACKET.STATE,
      data: {
        id: GAME_STATE.GAME_END,
        time: 7,  // Send 7 seconds for countdown
        data: gameEndData
      }
    });
    
    // Start countdown timer in top-left clock
    const countdownInterval = setInterval(() => {
      room.timer--;
      io.to(room.id).emit('data', {
        id: PACKET.TIMER,
        data: room.timer
      });
      
      if (room.timer <= 0) {
        clearInterval(countdownInterval);
        
        // For public rooms: stay on podium forever; no new game. Users use "Back to home".
        if (room.isPublic) {
          console.log(`🏁 [PUBLIC ROOM] Game ended for room ${room.id}; staying on podium until users go home`);
          return; // Stay in GAME_END; client shows Back to home button
        }
        // Private rooms: return to lobby (settings screen)
        room.state = GAME_STATE.LOBBY;
        room.currentRound = 0;
        room.currentDrawer = -1;
        room.currentWord = '';
        room.timer = 0;
        room.players.forEach(p => {
          p.score = 0;
          p.guessed = false;
        });
        
        // Send LOBBY state to all clients
        io.to(room.id).emit('data', {
          id: PACKET.STATE,
          data: {
            id: GAME_STATE.LOBBY,
            time: 0,
            data: {}
          }
        });
      }
    }, 1000);
  }
  
  // Handle votekick logic (like doodl)
  function handleVotekick(room, voterId, targetId) {
    // Can't votekick yourself or the owner
    if (voterId === targetId || targetId === room.owner) {
      return;
    }
    
    // Initialize votekick tracking if not exists
    if (!room.votekicks) {
      room.votekicks = new Map();
    }
    
    // Clean up expired votes (older than 30 seconds)
    const now = Date.now();
    const VOTE_EXPIRY_MS = 30000; // 30 seconds
    for (const [key, vote] of room.votekicks.entries()) {
      if (now - vote.timestamp > VOTE_EXPIRY_MS) {
        room.votekicks.delete(key);
      }
    }
    
    const votekickKey = `${voterId}_${targetId}`;
    
    // Check if already voted
    if (room.votekicks.has(votekickKey)) {
      return; // Already voted
    }
    
    // Add vote with timestamp
    room.votekicks.set(votekickKey, { voterId, targetId, timestamp: now });
    
    // Set expiration timer for this vote (30 seconds)
    setTimeout(() => {
      if (room.votekicks && room.votekicks.has(votekickKey)) {
        room.votekicks.delete(votekickKey);
        // Recalculate and broadcast updated vote count
    let voteCount = 0;
    for (const [key, vote] of room.votekicks.entries()) {
      if (vote.targetId === targetId) {
        voteCount++;
      }
    }
        const targetPlayer = room.players.find(p => p.id === targetId);
        if (targetPlayer) {
          const playerCount = room.players.length;
          let requiredVotes;
          if (playerCount >= 8) {
            requiredVotes = 5; // 8+ players need 5 votes
          } else if (playerCount <= 3) {
            requiredVotes = 2; // 2-3 players need 2 votes
          } else {
            // For 4-7 players, use proportional: roughly 60% rounded up
            requiredVotes = Math.ceil(playerCount * 0.6);
          }
          io.to(room.id).emit('data', {
            id: PACKET.VOTEKICK,
            data: [null, targetId, voteCount, requiredVotes] // null voterId indicates vote expired
          });
        }
      }
    }, VOTE_EXPIRY_MS);
    
    const targetPlayer = room.players.find(p => p.id === targetId);
    const voterPlayer = room.players.find(p => p.id === voterId);
    
    if (!targetPlayer || !voterPlayer) {
      return;
    }
    
    // Calculate required votes based on lobby size
    // 8 players: need 5 votes
    // For other sizes, use proportional logic
    const playerCount = room.players.length;
    let requiredVotes;
    if (playerCount >= 8) {
      requiredVotes = 5; // 8+ players need 5 votes
    } else if (playerCount <= 3) {
      requiredVotes = 2; // 2-3 players need 2 votes
    } else {
      // For 4-7 players, use proportional: roughly 60% rounded up
      requiredVotes = Math.ceil(playerCount * 0.6);
    }
    
    // Count votes for this target (only non-expired votes)
    let voteCount = 0;
    for (const [key, vote] of room.votekicks.entries()) {
      if (vote.targetId === targetId && (now - vote.timestamp) <= VOTE_EXPIRY_MS) {
        voteCount++;
      }
    }
    
    // Broadcast vote progress
    io.to(room.id).emit('data', {
      id: PACKET.VOTEKICK,
      data: [voterId, targetId, voteCount, requiredVotes]
    });
    
    // Send message to chat (system message - no player ID)
    io.to(room.id).emit('data', {
      id: PACKET.CHAT,
      data: {
        id: null,  // System message - no player name prefix
        msg: `${voterPlayer.name} is voting to kick ${targetPlayer.name} (${voteCount}/${requiredVotes})`
      }
    });
    
    // Check if enough votes reached
    if (voteCount >= requiredVotes) {
      // Kick the player
      kickPlayer(room, targetId, 1);
      
      // Clear votekick entries for this target
      for (const [key, vote] of room.votekicks.entries()) {
        if (vote.targetId === targetId) {
          room.votekicks.delete(key);
        }
      }
    }
  }
  
  function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  function levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }
});

// Initialize public rooms on startup
initializePublicRooms();

// Global error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - let the server continue running
  // Render will restart if needed
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - let the server continue running
});

// Handle socket.io connection errors
io.engine.on('connection_error', (err) => {
  console.error('❌ Socket.IO connection error:', err);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// ============================================
// PRIZE POOL & FEE DISTRIBUTION SYSTEM
// ============================================

// Configuration
const FEE_DISTRIBUTION_CONFIG = {
  CREATOR_SHARE: 0.2, // 20% stays in creator wallet
  PRIZE_POOL_SHARE: 0.8, // 80% goes to prize pools
  CLAIM_INTERVAL_MS: 30000, // Claim fees every 30 seconds
  PUMPFUN_TOKEN_ADDRESS: process.env.PUMPFUN_TOKEN_ADDRESS || '', // Set when token is launched
  CREATOR_WALLET: process.env.CREATOR_WALLET || '3y4vTFotbXPsJNX5KecTrWPmpwK63HFGFumrz3zmEKP3', // Your Solana wallet address
  CREATOR_SECRET_KEY: process.env.CREATOR_SECRET_KEY || '23SzmcnZNmEmhGtxGxEmvvWA9tcHuAWNaKEDKsdSgFYA2wEFCxBun5dYEzBaf9NuMSqR5HBzpRvgMLEvKPef9PMF', // Base58 private key
  PUMPPORTAL_API_KEY: process.env.PUMPPORTAL_API_KEY || 'a1amjdv46nu4rmu761v6md1bet34rv3nahj4jpb88t96ux2ha9nqmuuad5rnmea18n2qgh28ch3n4p3b6xj4ywtk9grn8u9pehkjpha7emtm2bv5eh9q0x1h95w7jcj8ct7qgrjh84yku95q6ukar9cvngebuahkkjhk8cccxgm8h9mcdhmghhf8xrnegk8c92pcpbr890kuf8', // PumpPortal API key
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || 'dbab0278-3123-4d7e-85bb-a284086b6ee4', // Helius API key
  HELIUS_RPC_URL: process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com/?api-key=dbab0278-3123-4d7e-85bb-a284086b6ee4', // Helius RPC URL
  BUYBACK_WALLET_ADDRESS: process.env.BUYBACK_WALLET_ADDRESS || '' // Optional: wallet for "use reward as buyback to chart"
};

// Holder head-start: top 20 token holders get a small point bonus at game start (getTokenLargestAccounts returns up to 20)
const HOLDER_BONUS = {
  TOKEN_MINT: process.env.PUMPFUN_TOKEN_ADDRESS || process.env.TOKEN_MINT_HOLDER_BONUS || '',
  RPC_URL: process.env.HELIUS_RPC_URL || FEE_DISTRIBUTION_CONFIG.HELIUS_RPC_URL,
  TOP_N: 20,
  // Modest bonus by rank tier (points added at game start)
  BONUS_TOP_10: 20,
  BONUS_11_TO_20: 15
};

/** Get owner address from SPL token account data (owner is bytes 32-64). */
function getOwnerFromTokenAccountData(data) {
  if (!data || data.length < 64) return null;
  const bs58 = require('bs58');
  const ownerBytes = data.slice(32, 64);
  return bs58.encode(ownerBytes);
}

/**
 * Fetch top token holders by balance. Returns Map<ownerBase58, rank> (rank 1 = largest holder).
 * Uses getTokenLargestAccounts (typically returns up to 20) + getMultipleAccounts to resolve owners.
 */
async function getTopTokenHolderRanks() {
  if (!HOLDER_BONUS.TOKEN_MINT || !HOLDER_BONUS.RPC_URL) return new Map();
  try {
    const { Connection, PublicKey } = require('@solana/web3.js');
    const connection = new Connection(HOLDER_BONUS.RPC_URL, 'confirmed');
    const mintPubkey = new PublicKey(HOLDER_BONUS.TOKEN_MINT);
    const largest = await connection.getTokenLargestAccounts(mintPubkey);
    if (!largest.value || largest.value.length === 0) return new Map();
    const accountAddresses = largest.value.map((v) => v.address);
    const infos = await connection.getMultipleAccountsInfo(accountAddresses);
    const rankByOwner = new Map();
    for (let i = 0; i < infos.length && (i + 1) <= HOLDER_BONUS.TOP_N; i++) {
      const info = infos[i];
      if (!info || !info.data) continue;
      const owner = getOwnerFromTokenAccountData(info.data);
      if (owner && !rankByOwner.has(owner)) {
        rankByOwner.set(owner, i + 1); // rank 1 = largest holder
      }
    }
    return rankByOwner;
  } catch (err) {
    console.warn('⚠️ Holder bonus: could not fetch top holders:', err.message);
    return new Map();
  }
}

function getHolderBonusPoints(rank) {
  if (rank <= 10) return HOLDER_BONUS.BONUS_TOP_10;
  if (rank <= 20) return HOLDER_BONUS.BONUS_11_TO_20;
  return 0;
}

/**
 * Apply a small point head-start to players who are in the top 50 token holders. Called at game start.
 * Always returns a Promise so startRound can be chained.
 */
async function applyHolderBonuses(room) {
  if (!HOLDER_BONUS.TOKEN_MINT) return Promise.resolve();
  const rankByOwner = await getTopTokenHolderRanks();
  if (rankByOwner.size === 0) return Promise.resolve();
  const walletNormalize = (w) => (w || '').trim();
  for (const p of room.players) {
    const wallet = walletNormalize(p.walletAddress);
    if (!wallet) continue;
    const rank = rankByOwner.get(wallet);
    if (rank == null) continue;
    const bonus = getHolderBonusPoints(rank);
    if (bonus > 0) {
      p.score = (p.score || 0) + bonus;
      p.roundStartScore = (p.roundStartScore || 0) + bonus;
      console.log(`🏆 Holder bonus: ${p.name} (rank #${rank}) +${bonus} pts`);
    }
  }
  return Promise.resolve();
}

// Using PumpPortal API for claiming Pumpfun creator fees
// Documentation: https://pumpportal.fun/creator-fee

// Send SOL to player using Helius API
async function sendSolToPlayer(recipientAddress, amountSOL, playerId, roomId) {
  try {
    if (!FEE_DISTRIBUTION_CONFIG.HELIUS_API_KEY || !FEE_DISTRIBUTION_CONFIG.HELIUS_RPC_URL) {
      throw new Error('Helius API not configured');
    }
    
    if (!FEE_DISTRIBUTION_CONFIG.CREATOR_SECRET_KEY) {
      throw new Error('Creator secret key not configured');
    }
    
    // Use Solana Web3.js to send SOL
    const { Connection, Keypair, PublicKey, SystemProgram, Transaction, VersionedTransaction } = require('@solana/web3.js');
    const bs58 = require('bs58');
    
    // Initialize connection
    const connection = new Connection(FEE_DISTRIBUTION_CONFIG.HELIUS_RPC_URL, 'confirmed');
    
    // Load creator keypair from Base58 private key
    const creatorKeypair = Keypair.fromSecretKey(bs58.decode(FEE_DISTRIBUTION_CONFIG.CREATOR_SECRET_KEY));
    const recipientPubkey = new PublicKey(recipientAddress);
    
    // Convert SOL to lamports
    const amountLamports = Math.floor(amountSOL * 1e9);
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    
    // Create transfer instruction
    const transferInstruction = SystemProgram.transfer({
      fromPubkey: creatorKeypair.publicKey,
      toPubkey: recipientPubkey,
      lamports: amountLamports
    });
    
    // Create and sign transaction
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: creatorKeypair.publicKey
    }).add(transferInstruction);
    
    transaction.sign(creatorKeypair);
    
    // Send transaction via Helius
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3
    });
    
    // Wait for confirmation
    await connection.confirmTransaction({
      signature: signature,
      blockhash: blockhash,
      lastValidBlockHeight: lastValidBlockHeight
    }, 'confirmed');
    
    console.log(`✅ Sent ${amountSOL} SOL to ${recipientAddress}. TX: https://solscan.io/tx/${signature}`);
    return signature;
    
  } catch (error) {
    console.error('❌ Error sending SOL:', error);
    throw error;
  }
}

/**
 * Execute real buyback: use reward SOL to buy the creator's token via PumpPortal trade API.
 * Uses trade-local so the buy is signed by the creator wallet and tokens go to the creator.
 */
async function executeBuybackWithPumpPortal(amountSOL, playerId, roomId) {
  const mint = (FEE_DISTRIBUTION_CONFIG.PUMPFUN_TOKEN_ADDRESS || '').trim();
  if (!mint) throw new Error('PUMPFUN_TOKEN_ADDRESS not set');
  if (!FEE_DISTRIBUTION_CONFIG.CREATOR_WALLET || !FEE_DISTRIBUTION_CONFIG.CREATOR_SECRET_KEY) {
    throw new Error('Creator wallet not configured');
  }
  if (!FEE_DISTRIBUTION_CONFIG.HELIUS_RPC_URL) throw new Error('RPC not configured');
  const apiKey = (FEE_DISTRIBUTION_CONFIG.PUMPPORTAL_API_KEY || '').trim();
  if (!apiKey) throw new Error('PumpPortal API key not set');

  const { Connection, Keypair, VersionedTransaction } = require('@solana/web3.js');
  const bs58 = require('bs58');

  const url = `https://pumpportal.fun/api/trade-local?api-key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: FEE_DISTRIBUTION_CONFIG.CREATOR_WALLET,
      action: 'buy',
      mint: mint,
      amount: amountSOL,
      denominatedInSol: true,
      slippage: 15,
      priorityFee: 0.00001,
      pool: 'pump'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`PumpPortal trade-local: ${response.status} ${errText}`);
  }

  const buf = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(buf));
  const creatorKeypair = Keypair.fromSecretKey(bs58.decode(FEE_DISTRIBUTION_CONFIG.CREATOR_SECRET_KEY));
  tx.sign([creatorKeypair]);

  const connection = new Connection(FEE_DISTRIBUTION_CONFIG.HELIUS_RPC_URL, 'confirmed');
  const signature = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
  console.log(`✅ Buyback: bought token with ${amountSOL} SOL. TX: https://solscan.io/tx/${signature}`);
  return signature;
}

// Prize pool distribution service
async function claimAndDistributeFees() {
  try {
    console.log('💰 Starting fee claim and distribution cycle...');
    
    let totalClaimedFees = 0;
    
    // Claim fees using PumpPortal API
    if (FEE_DISTRIBUTION_CONFIG.PUMPPORTAL_API_KEY && FEE_DISTRIBUTION_CONFIG.CREATOR_WALLET) {
      try {
        // Use PumpPortal Lightning Transaction API to claim creator fees
        // Note: pump.fun claims all creator fees at once, so no need to specify mint
        const response = await fetch(`https://pumpportal.fun/api/trade?api-key=${FEE_DISTRIBUTION_CONFIG.PUMPPORTAL_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'collectCreatorFee',
            priorityFee: 0.000001,
            pool: 'pump' // Use 'pump' for Pumpfun, 'meteora-dbc' for Meteora
            // Note: pump.fun claims all creator fees at once, so no "mint" parameter needed
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.signature) {
            console.log(`✅ Creator fees claimed! Transaction: https://solscan.io/tx/${data.signature}`);
            
            // After claiming, we need to check the wallet balance to see how much was claimed
            // For now, we'll use a placeholder - you may want to track this differently
            // TODO: Check wallet balance before/after to calculate actual claimed amount
            totalClaimedFees = 0; // Will be calculated from balance difference
          } else if (data.error) {
            console.log(`⚠️ No fees to claim or error: ${data.error}`);
            totalClaimedFees = 0;
          }
        } else {
          const errorText = await response.text();
          console.log(`⚠️ PumpPortal API error: ${response.status} - ${errorText}`);
          totalClaimedFees = 0;
        }
      } catch (error) {
        console.error('❌ Error claiming fees from PumpPortal:', error);
        totalClaimedFees = 0;
      }
    } else {
      console.log('⚠️ PumpPortal API key or creator wallet not configured');
      totalClaimedFees = 0;
    }
    
    if (totalClaimedFees <= 0) {
      console.log('💰 No fees to distribute');
      return;
    }
    
    // Split fees: 80% to prize pools, 20% to creator
    const prizePoolAmount = totalClaimedFees * FEE_DISTRIBUTION_CONFIG.PRIZE_POOL_SHARE;
    const creatorAmount = totalClaimedFees * FEE_DISTRIBUTION_CONFIG.CREATOR_SHARE;
    
    console.log(`💰 Total fees claimed: ${totalClaimedFees} SOL`);
    console.log(`💰 Prize pool share: ${prizePoolAmount} SOL (80%)`);
    console.log(`💰 Creator share: ${creatorAmount} SOL (20%)`);
    
    // Find all active lobbies (game has started, prize pool not frozen)
    const activeLobbies = [];
    for (const [roomId, room] of rooms.entries()) {
      if (room.gameStarted && !room.prizePoolFrozen) {
        activeLobbies.push(room);
      }
    }
    
    if (activeLobbies.length === 0) {
      console.log('💰 No active lobbies to distribute to');
      // TODO: Store unclaimed fees or send to creator wallet
      return;
    }
    
    // Distribute prize pool amount equally across all active lobbies
    const amountPerLobby = prizePoolAmount / activeLobbies.length;
    
    console.log(`💰 Distributing ${amountPerLobby} SOL to ${activeLobbies.length} active lobby/lobbies`);
    
    activeLobbies.forEach(room => {
      room.prizePool += amountPerLobby;
      console.log(`💰 Room ${room.id} prize pool: ${room.prizePool} SOL (+${amountPerLobby})`);
      
      // Broadcast updated prize pool to all players in the room
      io.to(room.id).emit('data', {
        id: PACKET.PRIZE_POOL_UPDATE,
        data: {
          prizePool: room.prizePool,
          prizePoolFrozen: room.prizePoolFrozen
        }
      });
    });
    
    // TODO: Send creator share to creator wallet
    // await sendSolToWallet(creatorKeypair, FEE_DISTRIBUTION_CONFIG.CREATOR_WALLET, creatorAmount);
    
    console.log('✅ Fee distribution cycle complete');
  } catch (error) {
    console.error('❌ Error in fee claim and distribution:', error);
  }
}

// Start fee claiming/distribution service (runs every 30 seconds)
if (FEE_DISTRIBUTION_CONFIG.PUMPFUN_TOKEN_ADDRESS) {
  console.log('💰 Prize pool system initialized');
  // Run immediately on startup, then every 30 seconds
  claimAndDistributeFees();
  setInterval(claimAndDistributeFees, FEE_DISTRIBUTION_CONFIG.CLAIM_INTERVAL_MS);
} else {
  console.log('⚠️ Prize pool system disabled - PUMPFUN_TOKEN_ADDRESS not set');
}

// ============================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`Public rooms initialized for English only`);
});

