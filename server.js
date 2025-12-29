const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
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

// Serve static files FIRST (CSS, JS, images, etc.) - MUST be before other routes
// Audio files are now valid OGG files, so they can be served as static files
app.use(express.static(__dirname, {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  index: false // Don't serve index.html as directory index
}));

// Serve favicon
app.get('/favicon.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon.png'));
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

// Word lists for different languages
const wordLists = {
  0: ['cat', 'dog', 'house', 'car', 'tree', 'sun', 'moon', 'star', 'bird', 'fish', 'apple', 'banana', 'book', 'chair', 'table', 'computer', 'phone', 'bicycle', 'flower', 'mountain'],
  1: ['Katze', 'Hund', 'Haus', 'Auto', 'Baum', 'Sonne', 'Mond', 'Stern', 'Vogel', 'Fisch', 'Apfel', 'Banane', 'Buch', 'Stuhl', 'Tisch', 'Computer', 'Telefon', 'Fahrrad', 'Blume', 'Berg'],
  2: ['котка', 'куче', 'къща', 'кола', 'дърво', 'слънце', 'луна', 'звезда', 'птица', 'риба', 'ябълка', 'банан', 'книга', 'стол', 'маса', 'компютър', 'телефон', 'колело', 'цвете', 'планина'],
  3: ['kočka', 'pes', 'dům', 'auto', 'strom', 'slunce', 'měsíc', 'hvězda', 'pták', 'ryba', 'jablko', 'banán', 'kniha', 'židle', 'stůl', 'počítač', 'telefon', 'kolo', 'květina', 'hora'],
  4: ['kat', 'hund', 'hus', 'bil', 'træ', 'sol', 'måne', 'stjerne', 'fugl', 'fisk', 'æble', 'banan', 'bog', 'stol', 'bord', 'computer', 'telefon', 'cykel', 'blomst', 'bjerg'],
  5: ['kat', 'hond', 'huis', 'auto', 'boom', 'zon', 'maan', 'ster', 'vogel', 'vis', 'appel', 'banaan', 'boek', 'stoel', 'tafel', 'computer', 'telefon', 'fiets', 'bloem', 'berg'],
  6: ['kissa', 'koira', 'talo', 'auto', 'puu', 'aurinko', 'kuu', 'tähti', 'lintu', 'kala', 'omena', 'banaani', 'kirja', 'tuoli', 'pöytä', 'tietokone', 'puhelin', 'polkupyörä', 'kukka', 'vuori'],
  7: ['chat', 'chien', 'maison', 'voiture', 'arbre', 'soleil', 'lune', 'étoile', 'oiseau', 'poisson', 'pomme', 'banane', 'livre', 'chaise', 'table', 'ordinateur', 'téléphone', 'vélo', 'fleur', 'montagne'],
  8: ['kass', 'koer', 'maja', 'auto', 'puu', 'päike', 'kuu', 'täht', 'lind', 'kala', 'õun', 'banaan', 'raamat', 'tool', 'laud', 'arvuti', 'telefon', 'jalgratas', 'lill', 'mägi'],
  9: ['γάτα', 'σκύλος', 'σπίτι', 'αυτοκίνητο', 'δένδρο', 'ήλιος', 'φεγγάρι', 'αστέρι', 'πουλί', 'ψάρι', 'μήλο', 'μπανάνα', 'βιβλίο', 'καρέκλα', 'τραπέζι', 'υπολογιστής', 'τηλέφωνο', 'ποδήλατο', 'λουλούδι', 'βουνό'],
  10: ['חתול', 'כלב', 'בית', 'מכונית', 'עץ', 'שמש', 'ירח', 'כוכב', 'ציפור', 'דג', 'תפוח', 'בננה', 'ספר', 'כיסא', 'שולחן', 'מחשב', 'טלפון', 'אופניים', 'פרח', 'הר'],
  11: ['macska', 'kutya', 'ház', 'autó', 'fa', 'nap', 'hold', 'csillag', 'madár', 'hal', 'alma', 'banán', 'könyv', 'szék', 'asztal', 'számítógép', 'telefon', 'kerékpár', 'virág', 'hegy'],
  12: ['gatto', 'cane', 'casa', 'auto', 'albero', 'sole', 'luna', 'stella', 'uccello', 'pesce', 'mela', 'banana', 'libro', 'sedia', 'tavolo', 'computer', 'telefono', 'bicicletta', 'fiore', 'montagna'],
  13: ['猫', '犬', '家', '車', '木', '太陽', '月', '星', '鳥', '魚', 'リンゴ', 'バナナ', '本', '椅子', 'テーブル', 'コンピューター', '電話', '自転車', '花', '山'],
  14: ['고양이', '개', '집', '자동차', '나무', '태양', '달', '별', '새', '물고기', '사과', '바나나', '책', '의자', '테이블', '컴퓨터', '전화', '자전거', '꽃', '산'],
  15: ['kaķis', 'suns', 'māja', 'mašīna', 'koks', 'saule', 'mēness', 'zvaigzne', 'putns', 'zivs', 'ābols', 'banāns', 'grāmata', 'krēsls', 'galds', 'dators', 'telefons', 'velosipēds', 'zieds', 'kalns'],
  16: ['мачка', 'куче', 'куќа', 'автомобил', 'дрво', 'сонце', 'месечина', 'ѕвезда', 'птица', 'риба', 'јаболко', 'банана', 'книга', 'стол', 'маса', 'компјутер', 'телефон', 'велосипед', 'цвет', 'планина'],
  17: ['katt', 'hund', 'hus', 'bil', 'tre', 'sol', 'måne', 'stjerne', 'fugl', 'fisk', 'eple', 'banan', 'bok', 'stol', 'bord', 'datamaskin', 'telefon', 'sykkel', 'blomst', 'fjell'],
  18: ['gato', 'cachorro', 'casa', 'carro', 'árvore', 'sol', 'lua', 'estrela', 'pássaro', 'peixe', 'maçã', 'banana', 'livro', 'cadeira', 'mesa', 'computador', 'telefone', 'bicicleta', 'flor', 'montanha'],
  19: ['kot', 'pies', 'dom', 'samochód', 'drzewo', 'słońce', 'księżyc', 'gwiazda', 'ptak', 'ryba', 'jabłko', 'banan', 'książka', 'krzesło', 'stół', 'komputer', 'telefon', 'rower', 'kwiat', 'góra'],
  20: ['pisică', 'câine', 'casă', 'mașină', 'copac', 'soare', 'lună', 'stea', 'pasăre', 'pește', 'măr', 'banană', 'carte', 'scaun', 'masă', 'computer', 'telefon', 'bicicletă', 'floare', 'munte'],
  21: ['кот', 'собака', 'дом', 'машина', 'дерево', 'солнце', 'луна', 'звезда', 'птица', 'рыба', 'яблоко', 'банан', 'книга', 'стул', 'стол', 'компьютер', 'телефон', 'велосипед', 'цветок', 'гора'],
  22: ['мачка', 'пас', 'кућа', 'аутомобил', 'дрво', 'сунце', 'месец', 'звезда', 'птица', 'риба', 'јабука', 'банана', 'књига', 'столица', 'сто', 'рачунар', 'телефон', 'бицикл', 'цвет', 'планина'],
  23: ['mačka', 'pes', 'dom', 'auto', 'strom', 'slnko', 'mesiac', 'hviezda', 'vták', 'ryba', 'jablko', 'banán', 'kniha', 'stolička', 'stôl', 'počítač', 'telefón', 'bicykel', 'kvetina', 'hora'],
  24: ['gato', 'perro', 'casa', 'coche', 'árbol', 'sol', 'luna', 'estrella', 'pájaro', 'pez', 'manzana', 'plátano', 'libro', 'silla', 'mesa', 'ordenador', 'teléfono', 'bicicleta', 'flor', 'montaña'],
  25: ['katt', 'hund', 'hus', 'bil', 'träd', 'sol', 'måne', 'stjärna', 'fågel', 'fisk', 'äpple', 'banan', 'bok', 'stol', 'bord', 'dator', 'telefon', 'cykel', 'blomma', 'berg'],
  26: ['pusa', 'aso', 'bahay', 'kotse', 'punong kahoy', 'araw', 'buwan', 'bituin', 'ibon', 'isda', 'mansanas', 'saging', 'aklat', 'upuan', 'lamesa', 'kompyuter', 'telepono', 'bisikleta', 'bulaklak', 'bundok'],
  27: ['kedi', 'köpek', 'ev', 'araba', 'ağaç', 'güneş', 'ay', 'yıldız', 'kuş', 'balık', 'elma', 'muz', 'kitap', 'sandalye', 'masa', 'bilgisayar', 'telefon', 'bisiklet', 'çiçek', 'dağ']
};

// Game state
const rooms = new Map();
const players = new Map(); // socket.id -> player info
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
  BAN: 4
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

function getRandomWords(lang, count, customWords = null) {
  const words = customWords && customWords.length >= 10 
    ? customWords.split(',').map(w => w.trim()).filter(w => w.length > 0 && w.length <= 32)
    : wordLists[lang] || wordLists[0];
  
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function calculateScore(timeRemaining, totalTime, wordLength) {
  const timeRatio = timeRemaining / totalTime;
  const baseScore = Math.floor(wordLength * 10);
  return Math.floor(baseScore * timeRatio);
}

// Initialize public rooms for each language
function initializePublicRooms() {
  for (let lang = 0; lang <= 27; lang++) {
    const roomId = `PUBLIC-${lang}`;
    if (!publicRooms.has(roomId)) {
      const room = {
        id: roomId,
        players: [],
        settings: [lang, 8, 80, 3, 3, 0, 0, 0], // Default settings
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
        isPublic: true
      };
      publicRooms.set(roomId, room);
      rooms.set(roomId, room);
    }
  }
}

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
    let lang = parseInt(body.lang || req.query.lang) || 0;
    
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
        settings: [lang, 8, 80, 3, 3, 0, 0, 0],
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
        isPublic: false
      };
      rooms.set(roomId, room);
      
      // Map room code to room ID for invite links
      roomCodes.set(roomCode, roomId);
      roomCodeToId.set(roomId, roomCode);
      console.log('🔗 Created private room with code:', roomCode, '→', roomId);
    } else if (!roomId) {
      // No roomId provided - this could be:
      // 1. Public room join (Play button) - use public room for language
      // 2. Private room create (Create button) - will be handled in Socket.IO login
      // For now, return a public room ID. Socket.IO login will create private room if create=1
      roomId = `PUBLIC-${lang}`;
      
      // Ensure public rooms are initialized
      if (publicRooms.size === 0) {
        initializePublicRooms();
      }
      
      // Get or create the public room
      let publicRoom = publicRooms.get(roomId);
      
      if (!publicRoom) {
        // Room doesn't exist, create it
        publicRoom = {
          id: roomId,
          players: [],
          settings: [lang, 8, 80, 3, 3, 0, 0, 0],
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
          isPublic: true
        };
        publicRooms.set(roomId, publicRoom);
        rooms.set(roomId, publicRoom);
        console.log('✅ Created public room:', roomId);
      } else if (publicRoom.players.length >= publicRoom.settings[SETTINGS.SLOTS] || 
                 publicRoom.state !== GAME_STATE.LOBBY) {
        // Room is full or in game, create a new one
        roomId = `PUBLIC-${lang}-${Date.now()}`;
        const newRoom = {
          id: roomId,
          players: [],
          settings: [lang, 8, 80, 3, 3, 0, 0, 0],
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
          isPublic: true
        };
        rooms.set(roomId, newRoom);
        console.log('✅ Created new public room instance:', roomId);
      } else {
        // Use existing room
        roomId = publicRoom.id;
        // Ensure it's in the main rooms map
        if (!rooms.has(roomId)) {
          rooms.set(roomId, publicRoom);
        }
      }
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
    
    // Force HTTPS on Render (check if host contains onrender.com)
    if (req.get('host') && req.get('host').includes('onrender.com')) {
      responseUrl = 'https://' + req.get('host');
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

io.on('connection', (socket) => {
  let player = null;
  let currentRoomId = null;
  
  socket.on('login', (data) => {
    const { join, create, name, lang, code, avatar } = data;
    let roomId = join || code;
    
    console.log('🔐 Socket.IO login:', { join, create, name, lang, code, roomId });
    
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
          settings: [parseInt(lang) || 0, 8, 80, 3, 3, 0, 0, 0],
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
          isPublic: false
        };
        rooms.set(roomId, room);
        roomCodes.set(roomCode, roomId);
        roomCodeToId.set(roomId, roomCode);
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
        settings: [parseInt(lang) || 0, 8, 80, 3, 3, 0, 0, 0],
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
        isPublic: create !== 1 && create !== '1'
      };
      rooms.set(roomId, room);
      console.log('✅ Created room:', roomId, 'isPublic:', room.isPublic);
    }
    
    const room = rooms.get(roomId);
    if (room.players.length >= room.settings[SETTINGS.SLOTS]) {
      socket.emit('joinerr', 2); // Room full
      return;
    }
    
    // Create player
    player = {
      id: socket.id,
      name: name || 'Player',
      avatar: avatar || [0, 0, 0, -1],
      score: 0,
      guessed: false,
      flags: 0,
      roomId: roomId
    };
    
    players.set(socket.id, player);
    socket.join(roomId);
    currentRoomId = roomId;
    
    // Add player to room
    room.players.push(player);
    
    // Set owner if first player
    if (!room.owner) {
      room.owner = socket.id;
    }
    
    // Send game data (include room code for private rooms)
    const gameData = {
      me: socket.id,
      type: create === 1 || create === '1' ? 1 : 0,
      id: roomId,
      users: room.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        guessed: p.guessed,
        flags: p.flags
      })),
      round: room.currentRound,
      owner: room.owner,
      settings: room.settings,
      state: {
        id: room.state,
        time: room.timer,
        data: room.state === GAME_STATE.DRAWING ? {
          id: room.currentDrawer,
          word: room.currentDrawer === socket.id ? room.currentWord : undefined,
          hints: [],
          drawCommands: room.drawCommands
        } : {}
      }
    };
    
    // Add room code for private rooms (for invite links)
    if (room.code) {
      gameData.code = room.code;
    }
    
    socket.emit('data', {
      id: PACKET.GAME_DATA,
      data: gameData
    });
    
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
  });
  
  socket.on('data', (data) => {
    if (!player || !currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    
    switch (data.id) {
      case PACKET.SETTINGS:
        if (room.owner === socket.id) {
          room.settings[data.data.id] = data.data.val;
          io.to(currentRoomId).emit('data', {
            id: PACKET.SETTINGS,
            data: data.data
          });
        }
        break;
        
      case PACKET.CUSTOM_WORDS:
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
            room.customWords
          );
          if (words && words[wordIndex] !== undefined) {
            room.currentWord = words[wordIndex];
            room.state = GAME_STATE.DRAWING;
            room.timer = room.settings[SETTINGS.DRAWTIME];
            room.startTime = Date.now();
            room.drawCommands = [];
            room.hintIndex = 0;
            room.hintInterval = null;
            
            // Start drawing timer
            startRoundTimer(room);
            
            // Start hint system if hints are enabled
            if (room.settings[SETTINGS.HINTCOUNT] > 0) {
              startHintSystem(room);
            }
            
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
        if (room.state === GAME_STATE.DRAWING && socket.id !== room.currentDrawer && !player.guessed) {
          const guess = data.data.toLowerCase().trim();
          const word = room.currentWord.toLowerCase().trim();
          
          if (guess === word) {
            const timeRemaining = room.timer;
            const score = calculateScore(timeRemaining, room.settings[SETTINGS.DRAWTIME], word.length);
            player.score += score;
            player.guessed = true;
            
            io.to(currentRoomId).emit('data', {
              id: PACKET.GUESS,
              data: {
                id: socket.id,
                word: room.currentWord,
                score: player.score  // Send updated score
              }
            });
            
            // Check if all players guessed
            const allGuessed = room.players.filter(p => p.id !== room.currentDrawer).every(p => p.guessed);
            if (allGuessed) {
              endRound(room, 0); // Everyone guessed
            }
          } else {
          // Check if close guess (Levenshtein distance)
          const similarity = calculateSimilarity(guess, word);
          // Use a lower threshold (0.6) to be more lenient with close guesses
          if (similarity >= 0.6 && similarity < 1.0) {
            socket.emit('data', {
              id: PACKET.CLOSE,
              data: guess
            });
          }
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
        
      case PACKET.CHAT:
        // Handle chat messages (packet id 30)
        if (room.state === GAME_STATE.DRAWING) {
          if (socket.id === room.currentDrawer) {
            // Drawer's chat - only send to drawer (they see it in green, others don't see it)
            socket.emit('data', {
              id: PACKET.CHAT,
              data: {
                id: socket.id,
                msg: data.data
              }
            });
          } else {
            // Regular chat during drawing - guessing players can chat normally
            io.to(currentRoomId).emit('data', {
              id: PACKET.CHAT,
              data: {
                id: socket.id,
                msg: data.data
              }
            });
          }
        } else if (room.state === GAME_STATE.LOBBY) {
          // Chat in lobby
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
          kickPlayer(room, data.data, 1);
        }
        break;
        
      case PACKET.BAN:
        if (room.owner === socket.id && data.data !== socket.id) {
          kickPlayer(room, data.data, 2);
        }
        break;
    }
  });
  
  socket.on('disconnect', () => {
    if (player && currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        // Remove player
        const index = room.players.findIndex(p => p.id === socket.id);
        if (index !== -1) {
          room.players.splice(index, 1);
          
          // If drawer left, end round
          if (room.currentDrawer === socket.id && room.state === GAME_STATE.DRAWING) {
            endRound(room, 1); // Drawer left
          }
          
          // Transfer ownership if needed
          if (room.owner === socket.id && room.players.length > 0) {
            room.owner = room.players[0].id;
            io.to(currentRoomId).emit('data', {
              id: PACKET.OWNER,
              data: room.owner
            });
          }
          
          // Broadcast leave
          socket.to(currentRoomId).emit('data', {
            id: PACKET.LEAVE,
            data: {
              id: socket.id,
              reason: 0
            }
          });
          
          // Clean up empty rooms
          if (room.players.length === 0) {
            rooms.delete(currentRoomId);
          }
        }
      }
      players.delete(socket.id);
    }
  });
  
  function startGame(room) {
    // Check minimum 2 players requirement
    if (room.players.length < 2) {
      // Notify owner that minimum 2 players are required
      io.to(room.owner).emit('data', {
        id: PACKET.CLOSE,
        data: 'Minimum 2 players required to start the game!'
      });
      return;
    }
    
    room.currentRound = 0;
    room.players.forEach(p => {
      p.score = 0;
      p.guessed = false;
    });
    startRound(room);
  }
  
  function startRound(room) {
    room.currentRound++;
    if (room.currentRound > room.settings[SETTINGS.ROUNDS]) {
      // Game end
      endGame(room);
      return;
    }
    
    // Select drawer (round robin)
    const drawerIndex = (room.currentRound - 1) % room.players.length;
    room.currentDrawer = room.players[drawerIndex].id;
    room.players.forEach(p => p.guessed = false);
    
    // Select words
    const words = getRandomWords(
      room.settings[SETTINGS.LANG],
      room.settings[SETTINGS.WORDCOUNT],
      room.customWords
    );
    
    room.state = GAME_STATE.WORD_CHOICE;
    room.timer = 15; // 15 second timer for word choice
    
    // Step 1: Send "Round X" text to overlay (no countdown in overlay)
    const roundNumber = room.currentRound - 1; // Round number (0-indexed, client adds 1)
    
    io.to(room.id).emit('data', {
      id: PACKET.STATE,
      data: {
        id: GAME_STATE.ROUND_START, // F = 2
        time: 0,
        data: roundNumber  // Normal round number (client will show "Round X")
      }
    });
    
    // Step 2: Send countdown (3, 2, 1) to clock only (using TIMER packets)
    let countdown = 3;
    
    const sendCountdown = () => {
      if (countdown > 0) {
        // Send countdown value to clock (TIMER packet)
        io.to(room.id).emit('data', {
          id: PACKET.TIMER,
          data: countdown
        });
        countdown--;
        setTimeout(sendCountdown, 1000);
      } else {
        // Countdown finished, hide overlay and send word choice states
        setTimeout(() => {
          sendWordChoice(room, words);
        }, 100);
      }
    };
    
    // Start countdown after a brief delay to show "Round X"
    setTimeout(() => {
      sendCountdown();
    }, 500);
  }
  
  function sendWordChoice(room, words) {
    room.state = GAME_STATE.WORD_CHOICE;
    room.timer = 15; // 15 second timer for word choice
    room.currentWords = words; // Store words in room for timer access
    
    // Send word choice to DRAWER (V = 3, WORD_CHOICE with words and timer)
    io.to(room.currentDrawer).emit('data', {
      id: PACKET.STATE,
      data: {
        id: GAME_STATE.WORD_CHOICE, // V = 3
        time: room.timer, // 15 seconds for word choice
        data: {
          words: words
        }
      }
    });
    
    // Send "choosing word" message to OTHER players (V = 3, WORD_CHOICE without words, with timer)
    room.players.forEach(player => {
      if (player.id !== room.currentDrawer) {
        io.to(player.id).emit('data', {
          id: PACKET.STATE,
          data: {
            id: GAME_STATE.WORD_CHOICE, // V = 3
            time: room.timer, // 15 seconds timer
            data: {
              id: room.currentDrawer  // Drawer's ID (client shows "$ is choosing a word!")
            }
          }
        });
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
          
          // Start drawing timer
          startRoundTimer(room);
          
          // Start hint system if hints are enabled
          if (room.settings[SETTINGS.HINTCOUNT] > 0) {
            startHintSystem(room);
          }
          
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
  
  function startHintSystem(room) {
    if (room.hintInterval) {
      clearInterval(room.hintInterval);
    }
    
    const hintCount = room.settings[SETTINGS.HINTCOUNT];
    const word = room.currentWord;
    const totalTime = room.settings[SETTINGS.DRAWTIME];
    const hintInterval = Math.floor(totalTime / (hintCount + 1));
    
    room.hintIndex = 0;
    const revealedIndices = new Set();
    
    room.hintInterval = setInterval(() => {
      if (room.hintIndex >= hintCount || room.state !== GAME_STATE.DRAWING) {
        clearInterval(room.hintInterval);
        room.hintInterval = null;
        return;
      }
      
      // Find a random unrevealed letter
      let index;
      do {
        index = Math.floor(Math.random() * word.length);
      } while (revealedIndices.has(index) && revealedIndices.size < word.length);
      
      revealedIndices.add(index);
      const character = word.charAt(index);
      
      // Send hint to all non-drawers
      io.to(room.id).emit('data', {
        id: PACKET.HINTS,
        data: [[index, character]]
      });
      
      room.hintIndex++;
    }, hintInterval * 1000);
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
    
    // Calculate scores
    const scores = [];
    room.players.forEach(p => {
      scores.push(p.id, p.score, 0);
    });
    
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
    
    // Wait 5 seconds, then start next round
    setTimeout(() => {
      startRound(room);
    }, 5000);
  }
  
  function endGame(room) {
    room.state = GAME_STATE.GAME_END;
    
    const rankings = room.players
      .map(p => [p.id, 0, ''])
      .sort((a, b) => {
        const playerA = room.players.find(p => p.id === a[0]);
        const playerB = room.players.find(p => p.id === b[0]);
        return (playerB?.score || 0) - (playerA?.score || 0);
      });
    
    rankings.forEach((rank, index) => {
      rank[1] = index;
    });
    
    io.to(room.id).emit('data', {
      id: PACKET.STATE,
      data: {
        id: GAME_STATE.GAME_END,
        time: 0,
        data: rankings
      }
    });
    
    // Reset room after 10 seconds
    setTimeout(() => {
      room.state = GAME_STATE.LOBBY;
      room.currentRound = 0;
      room.players.forEach(p => {
        p.score = 0;
        p.guessed = false;
      });
    }, 10000);
  }
  
  function kickPlayer(room, playerId, reason) {
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      const index = room.players.findIndex(p => p.id === playerId);
      if (index !== -1) {
        room.players.splice(index, 1);
        playerSocket.emit('reason', reason);
        playerSocket.disconnect();
        
        socket.to(room.id).emit('data', {
          id: PACKET.LEAVE,
          data: {
            id: playerId,
            reason: reason
          }
        });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Public rooms initialized for all languages`);
});

