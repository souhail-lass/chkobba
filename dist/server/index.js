/**
 * Chkobba Server
 * Express + Socket.IO server for multiplayer card game
 */
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';
import store from './store.js';
import Game from './game/Game.js';
import { RummyGame } from './game/RummyGame.js';
import { getBotMove, executeRummyBotTurn, getRandomBotName } from './game/Bot.js';
import { generatePlayerId } from './game/Room.js';
import { isValidGameEmoteId, GAME_EMOTE_COOLDOWN_MS } from '../shared/emotes.js';
import { dealAnimationDurationMs, SPECIAL_CAPTURE_PAUSE_MS } from '../shared/timing.js';
/** Per-room per-player emote spam guard */
const lastGameEmoteAt = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Initialize Express
const app = express();
const server = http.createServer(app);
// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: true, // Dynamically allow any origin for development/testing
        methods: ["GET", "POST"],
        credentials: true
    }
});
// Serve static files from client build (for Render deployment)
const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
// Health check route
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});
// Explicit routes for SEO/Static files to ensure they are NOT caught by the SPA fallback
app.get('/sitemap.xml', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'sitemap.xml'));
});
app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'robots.txt'));
});
// Prerendered SEO pages (static HTML generated at build time)
app.get(['/how-to-play', '/how-to-play/'], (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'how-to-play', 'index.html'));
});
// Serve static files from client build
app.use(express.static(clientDistPath));
// Game instances stored by room ID
const chkobbaGames = new Map();
const rummyGames = new Map();
// Player to socket mapping
const playerSockets = new Map();
/** Clear per-socket session refs when a player is kicked (avoids stale currentRoom on server) */
const socketSessionCleanups = new Map();
// Turn timers (AFK + bot delay) by room ID
const turnTimers = new Map();
function clearTurnTimer(roomId) {
    const t = turnTimers.get(roomId);
    if (t) {
        clearTimeout(t);
        turnTimers.delete(roomId);
    }
}
/** Wait before starting AFK/bot turn timer (dealing overlay or special capture). */
function scheduleTurnTimer(roomId, delayMs) {
    clearTurnTimer(roomId);
    const t = setTimeout(() => {
        turnTimers.delete(roomId);
        startTurnTimer(roomId);
    }, delayMs);
    turnTimers.set(roomId, t);
}
function scheduleTurnAfterDeal(roomId) {
    const room = store.getRoom(roomId);
    if (!room)
        return;
    const gt = room.gameType === 'rummy' ? 'rummy' : 'chkobba';
    scheduleTurnTimer(roomId, dealAnimationDurationMs(gt, room.players.length));
}
/**
 * Get or create Chkobba game for a room
 * @param {string} roomId - Room ID
 * @param {Room} room - Room object
 * @returns {Game}
 */
function getOrCreateChkobbaGame(roomId, room) {
    if (!chkobbaGames.has(roomId)) {
        const game = new Game(roomId, room.players, room.targetScore);
        chkobbaGames.set(roomId, game);
    }
    return chkobbaGames.get(roomId);
}
/**
 * Get or create Rummy game for a room
 * @param {string} roomId - Room ID
 * @param {Room} room - Room object
 * @returns {RummyGame}
 */
function getOrCreateRummyGame(roomId, room) {
    if (!rummyGames.has(roomId)) {
        const deckCount = room.players.length <= 6 ? 1 : room.players.length <= 8 ? 2 : 3;
        const game = new RummyGame(roomId, room.players, deckCount);
        rummyGames.set(roomId, game);
    }
    return rummyGames.get(roomId);
}
/**
 * Delete games for a room
 * @param {string} roomId - Room ID
 */
function deleteGames(roomId) {
    chkobbaGames.delete(roomId);
    rummyGames.delete(roomId);
}
/**
 * Broadcast room state to all players
 * @param {string} roomId - Room ID
 */
function broadcastRoomUpdate(roomId) {
    const room = store.getRoom(roomId);
    if (!room)
        return;
    io.to(roomId).emit('room_update', room.toPublicState());
}
/**
 * Broadcast Chkobba game state to all players
 * @param {string} roomId - Room ID
 */
function broadcastChkobbaGameState(roomId) {
    const game = chkobbaGames.get(roomId);
    if (!game)
        return;
    const room = store.getRoom(roomId);
    if (!room)
        return;
    console.log(`[Server] Broadcasting Chkobba game state for room ${roomId}, players: ${room.players.length}`);
    // Send full state to each player (with their hand)
    for (const player of room.players) {
        if (player.isConnected) {
            const socket = getSocketByPlayerId(player.id);
            if (socket) {
                const fullState = game.getFullState(player.id);
                console.log(`[Server] Sending Chkobba game state to ${player.nickname}, hand: ${fullState.hand?.length || 0} cards`);
                socket.emit('game_state', fullState);
            }
            else {
                console.log(`[Server] Could not find socket for player ${player.id} (${player.nickname})`);
            }
        }
    }
}
/**
 * Broadcast Rummy game state to all players
 * @param {string} roomId - Room ID
 */
function broadcastRummyGameState(roomId) {
    const game = rummyGames.get(roomId);
    if (!game)
        return;
    const room = store.getRoom(roomId);
    if (!room)
        return;
    console.log(`[Server] Broadcasting Rummy game state for room ${roomId}, players: ${room.players.length}`);
    // Send full state to each player (with their hand)
    for (const player of room.players) {
        if (player.isConnected) {
            const socket = getSocketByPlayerId(player.id);
            if (socket) {
                const fullState = game.getFullState(player.id);
                socket.emit('game_state', fullState);
            }
        }
    }
}
/**
 * Broadcast game state based on room game type
 * @param {string} roomId - Room ID
 */
function broadcastGameState(roomId) {
    const room = store.getRoom(roomId);
    if (!room)
        return;
    if (room.gameType === 'rummy') {
        broadcastRummyGameState(roomId);
    }
    else {
        broadcastChkobbaGameState(roomId);
    }
}
/**
 * Execute a bot move for the current turn in a room
 */
function executeBotMove(roomId, botPlayerId) {
    const room = store.getRoom(roomId);
    if (!room)
        return;
    try {
        if (room.gameType === 'rummy') {
            const game = rummyGames.get(roomId);
            if (!game || game.winner || game.roundJustEnded)
                return;
            executeRummyBotTurn(game, botPlayerId);
            room.lastActivity = Date.now();
            broadcastGameState(roomId);
            if (game.roundJustEnded && game.lastRoundResult) {
                io.to(roomId).emit('round_end', game.lastRoundResult);
                if (game.winner) {
                    const scores = { team0: 0, team1: 0 };
                    for (const p of game.players) {
                        if (p.team === 0)
                            scores.team0 += p.penaltyPoints || 0;
                        else
                            scores.team1 += p.penaltyPoints || 0;
                    }
                    io.to(roomId).emit('game_over', { winner: game.winner, scores });
                    return;
                }
                // Auto-add bots to continue
                for (const p of room.players) {
                    if (p.isBot)
                        game.continuePlayers.add(p.id);
                }
                return;
            }
            startTurnTimer(roomId);
        }
        else {
            const game = chkobbaGames.get(roomId);
            if (!game || game.winner)
                return;
            const move = getBotMove(game, botPlayerId);
            const result = game.playCard(botPlayerId, move.cardIndex, move.tableIndices);
            if (!result.success) {
                // Fallback: play first card as discard
                game.playCard(botPlayerId, 0, []);
            }
            room.lastActivity = Date.now();
            broadcastGameState(roomId);
            const botPlayer = room.players.find(p => p.id === botPlayerId);
            if (result.capture?.isChkobba) {
                io.to(roomId).emit('chkobba', {
                    playerId: botPlayerId,
                    playerNickname: botPlayer?.nickname || 'Bot'
                });
            }
            if (result.capture?.isHayya) {
                io.to(roomId).emit('hayya_captured', {
                    playerId: botPlayerId,
                    playerNickname: botPlayer?.nickname || 'Bot'
                });
            }
            if (game.roundJustEnded && game.lastRoundResult) {
                io.to(roomId).emit('round_end', game.lastRoundResult);
                if (game.winner) {
                    io.to(roomId).emit('game_over', { winner: game.winner, scores: game.scores });
                    return;
                }
                // Auto-add all bots to continuePlayers so only humans need to click Continue
                for (const p of room.players) {
                    if (p.isBot)
                        game.continuePlayers.add(p.id);
                }
                // Don't start next timer — wait for humans to click Continue
                return;
            }
            if (result.capture?.isChkobba || result.capture?.isHayya) {
                scheduleTurnTimer(roomId, SPECIAL_CAPTURE_PAUSE_MS);
            }
            else {
                startTurnTimer(roomId);
            }
        }
    }
    catch (err) {
        console.error(`[Bot] Error executing move in room ${roomId}:`, err);
    }
}
/**
 * Start (or restart) the turn timer for a room.
 * - If the current player is a bot: schedule auto-play.
 * - If the current player is a human and turnTimeout > 0: start AFK timer and
 *   broadcast turn_started so clients can show a countdown.
 */
function startTurnTimer(roomId) {
    clearTurnTimer(roomId);
    const room = store.getRoom(roomId);
    if (!room || room.status !== config.GAME_STATUS.PLAYING)
        return;
    let currentPlayerId;
    let isGameOver = false;
    let isRoundEnded = false;
    if (room.gameType === 'rummy') {
        const game = rummyGames.get(roomId);
        if (!game)
            return;
        currentPlayerId = game.currentTurn;
        isGameOver = !!game.winner;
    }
    else {
        const game = chkobbaGames.get(roomId);
        if (!game)
            return;
        currentPlayerId = game.currentTurn;
        isGameOver = !!game.winner;
        isRoundEnded = game.roundJustEnded;
    }
    if (isGameOver || isRoundEnded)
        return;
    const currentPlayer = room.players.find(p => p.id === currentPlayerId);
    if (!currentPlayer)
        return;
    if (currentPlayer.isBot) {
        // Natural-feeling bot delay: 0.8 – 2 s
        const delay = room.gameType === 'rummy' ? 1500 + Math.random() * 1500 : 800 + Math.random() * 1200;
        const t = setTimeout(() => {
            turnTimers.delete(roomId);
            executeBotMove(roomId, currentPlayerId);
        }, delay);
        turnTimers.set(roomId, t);
    }
    else if (room.turnTimeout > 0) {
        // Broadcast turn start so clients can render a countdown
        io.to(roomId).emit('turn_started', {
            playerId: currentPlayerId,
            timeout: room.turnTimeout,
            startedAt: Date.now()
        });
        const t = setTimeout(() => {
            turnTimers.delete(roomId);
            const updRoom = store.getRoom(roomId);
            let isStillGameOver = false;
            if (updRoom?.gameType === 'rummy') {
                isStillGameOver = !!rummyGames.get(roomId)?.winner;
            }
            else {
                isStillGameOver = !!chkobbaGames.get(roomId)?.winner;
            }
            if (!updRoom || isStillGameOver)
                return;
            const afkPlayer = updRoom.players.find(p => p.id === currentPlayerId);
            if (!afkPlayer || afkPlayer.isBot)
                return;
            console.log(`[Server] AFK timeout for ${afkPlayer.nickname} in room ${roomId}. Converting to bot.`);
            // Disconnect their socket
            const afkSocket = getSocketByPlayerId(afkPlayer.id);
            if (afkSocket)
                afkSocket.disconnect(true);
            playerSockets.delete(afkPlayer.id);
            // Notify room
            io.to(roomId).emit('player_afk_kicked', {
                playerId: afkPlayer.id,
                playerNickname: afkPlayer.nickname
            });
            // Convert player to bot in-place (keeps same team / turn order slot)
            afkPlayer.isBot = true;
            afkPlayer.isConnected = false;
            broadcastRoomUpdate(roomId);
            // Bot now takes their turn
            startTurnTimer(roomId);
        }, room.turnTimeout * 1000);
        turnTimers.set(roomId, t);
    }
}
/**
 * Get socket by player ID
 * @param {string} playerId - Player ID
 * @returns {Socket|null}
 */
function getSocketByPlayerId(playerId) {
    const socketId = playerSockets.get(playerId);
    if (socketId) {
        return io.sockets.sockets.get(socketId) || null;
    }
    return null;
}
/**
 * Handle player disconnect
 * @param {Socket} socket - Socket
 * @param {Room} room - Room
 * @param {Player} player - Player
 */
function handleDisconnect(socket, room, player) {
    // If it was their turn, cancel the AFK timer (they're already gone)
    // It will be restarted if/when they rejoin or after auto-win logic
    clearTurnTimer(room.id);
    const wasHost = player.isHost;
    room.removePlayer(player.id);
    // If host left, and we are not playing, we should promote new host immediately
    if (wasHost && room.status === config.GAME_STATUS.LOBBY) {
        const newHost = room.players.find(p => p.isConnected);
        if (newHost) {
            newHost.isHost = true;
            room.hostId = newHost.id;
            const hostSocket = getSocketByPlayerId(newHost.id);
            if (hostSocket) {
                hostSocket.emit('error', { message: 'The host left. You are now the host!' });
            }
        }
    }
    // Handle round continuation if someone disconnects while waiting for next round
    if (room.status === config.GAME_STATUS.PLAYING) {
        const game = chkobbaGames.get(room.id) || rummyGames.get(room.id);
        if (game && game.roundJustEnded && !game.winner) {
            const connectedHumanIds = room.getConnectedPlayers()
                .filter(p => !p.isBot)
                .map(p => p.id);
            // If we have no humans left, or all connected humans already said continue
            const allReady = connectedHumanIds.length === 0 ||
                connectedHumanIds.every(id => game.continuePlayers.has(id));
            if (allReady) {
                if (room.gameType === 'rummy') {
                    game.startNewRound();
                    io.to(room.id).emit('new_round');
                }
                else {
                    game.startNewRound();
                    io.to(room.id).emit('new_round');
                }
                broadcastGameState(room.id);
                scheduleTurnAfterDeal(room.id);
            }
        }
    }
    // Notify others
    socket.to(room.id).emit('player_disconnected', { playerId: player.id });
    broadcastRoomUpdate(room.id);
    // If game is playing, handle replacement or auto-win
    if (room.status === config.GAME_STATUS.PLAYING) {
        const opposingTeam = room.getTeam(player.team === 0 ? 1 : 0);
        // Bots are stored with isConnected: true, so "opponent still connected" must ignore bots.
        // Otherwise 1v1 human vs bot treats the bot as a connected opponent and wrongly converts
        // the human to a bot on refresh before rejoin_game runs.
        const opposingHumans = opposingTeam.filter((p) => !p.isBot);
        const allHumanOpponentsDisconnected = opposingTeam.length > 0 &&
            (opposingHumans.length === 0 || opposingHumans.every((p) => !p.isConnected));
        if (allHumanOpponentsDisconnected) {
            // 1v1 or Team Exit: Start timer for auto-win
            if (room.disconnectTimer)
                clearTimeout(room.disconnectTimer);
            room.disconnectTimer = setTimeout(() => {
                const updatedRoom = store.getRoom(room.id);
                if (!updatedRoom)
                    return;
                const updatedPlayer = updatedRoom.players.find(p => p.id === player.id);
                if (updatedPlayer && !updatedPlayer.isConnected) {
                    updatedRoom.status = config.GAME_STATUS.FINISHED;
                    const winningTeam = player.team === 0 ? 1 : 0;
                    io.to(room.id).emit('auto_win', {
                        winner: { team: winningTeam, reason: 'timeout' }
                    });
                    const game = chkobbaGames.get(room.id) || rummyGames.get(room.id);
                    if (game) {
                        game.forceWin(winningTeam);
                        broadcastGameState(room.id);
                    }
                }
            }, config.DISCONNECT_TIMEOUT_MS || 60000);
            // Warning after 30s
            setTimeout(() => {
                const stillRoom = store.getRoom(room.id);
                const stillPlayer = stillRoom?.players.find(p => p.id === player.id);
                if (stillPlayer && !stillPlayer.isConnected) {
                    io.to(room.id).emit('auto_win_warning', {
                        timeRemaining: 30,
                        playerNickname: player.nickname
                    });
                }
            }, (config.DISCONNECT_TIMEOUT_MS || 60000) / 2);
            return;
        }
        // Replace with a bot only when another *human* is still in the game (teammate or opponent).
        // If everyone else is bots, keep this seat as a disconnected human so refresh/rejoin works.
        const hasOtherConnectedHuman = room.players.some((p) => p.id !== player.id && p.isConnected && !p.isBot);
        if (hasOtherConnectedHuman) {
            console.log(`[Server] Replacing disconnected player ${player.nickname} with bot.`);
            player.isBot = true;
            player.isConnected = false;
            // Auto-continue if round ended
            const game = chkobbaGames.get(room.id) || rummyGames.get(room.id);
            if (game && game.continuePlayers) {
                game.continuePlayers.add(player.id);
            }
        }
        else {
            console.log(`[Server] Disconnect for ${player.nickname}: no other humans in room — keeping seat for rejoin (not converting to bot).`);
        }
        broadcastRoomUpdate(room.id);
        broadcastGameState(room.id);
        startTurnTimer(room.id);
    }
}
// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`[Server] Client connected: ${socket.id}`);
    let currentRoom = null;
    let currentPlayer = null;
    const clearMySession = () => {
        currentRoom = null;
        currentPlayer = null;
    };
    socketSessionCleanups.set(socket.id, clearMySession);
    /**
     * Create a new room
     */
    socket.on('create_room', ({ nickname, targetScore, maxPlayers, gameType, hostTeam, turnTimeout }) => {
        console.log('[Server] create_room event:', { nickname, targetScore, maxPlayers, gameType, hostTeam, turnTimeout });
        try {
            const room = store.createRoom(socket.id, targetScore, maxPlayers, gameType || 'chkobba', turnTimeout ?? config.DEFAULT_TURN_TIMEOUT);
            const { player, error } = room.addPlayer(nickname);
            if (error || !player) {
                socket.emit('error', { message: error || 'Failed to add player' });
                store.deleteRoom(room.id);
                return;
            }
            currentRoom = room;
            currentPlayer = player;
            // Apply host team preference for 2-player Chkobba
            if (gameType === 'chkobba' && maxPlayers === 2 && hostTeam !== undefined) {
                if (hostTeam === 0 || hostTeam === 1) {
                    player.team = hostTeam;
                    console.log(`[Server] Applied host team preference: ${hostTeam}`);
                }
            }
            // Map player to socket
            playerSockets.set(player.id, socket.id);
            socket.join(room.id);
            socket.emit('room_created', { roomId: room.id });
            socket.emit('room_joined', {
                room: room.toPublicState(),
                player
            });
            console.log(`[Server] Room created: ${room.id} by ${nickname} (${room.gameType})`);
        }
        catch (err) {
            console.error('[Server] Error creating room:', err);
            socket.emit('error', { message: 'Failed to create room: ' + err.message });
        }
    });
    /**
     * Rejoin a room using playerId (Persistence)
     */
    socket.on('rejoin_game', ({ roomId, playerId }) => {
        console.log(`[Server] Persistent rejoin request: Room ${roomId}, Player ${playerId}, New Socket ${socket.id}`);
        try {
            const room = store.getRoom(roomId.toUpperCase());
            if (!room) {
                console.log(`[Server] Rejoin failed: Room ${roomId} not found`);
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            const existingPlayer = room.players.find(p => p.id === playerId);
            if (!existingPlayer) {
                console.log(`[Server] Rejoin failed: Player ${playerId} not in room ${roomId}`);
                socket.emit('error', { message: 'Session not found in this room' });
                return;
            }
            // Important: Force update socket mapping even if they appear "connected"
            // This happens when they refresh faster than the server registers a disconnect.
            const oldSocketId = playerSockets.get(playerId);
            if (oldSocketId && oldSocketId !== socket.id) {
                console.log(`[Server] Overriding old socket ${oldSocketId} with new socket ${socket.id} for player ${playerId}`);
                const oldSocket = io.sockets.sockets.get(oldSocketId);
                if (oldSocket)
                    oldSocket.disconnect(true);
            }
            existingPlayer.isConnected = true;
            playerSockets.set(playerId, socket.id);
            currentRoom = room;
            currentPlayer = existingPlayer;
            socket.join(room.id);
            // Cancel any auto-win/disconnect timers
            if (room.disconnectTimer) {
                clearTimeout(room.disconnectTimer);
                room.disconnectTimer = null;
            }
            socket.emit('room_joined', {
                room: room.toPublicState(),
                player: existingPlayer
            });
            // Crucial: Send immediate game state if playing
            if (room.status === config.GAME_STATUS.PLAYING) {
                const game = room.gameType === 'rummy' ? rummyGames.get(room.id) : chkobbaGames.get(room.id);
                if (game) {
                    const fullState = game.getFullState(playerId);
                    socket.emit('game_state', fullState);
                    console.log(`[Server] Restored game state for ${existingPlayer.nickname}`);
                }
            }
            socket.to(room.id).emit('player_reconnected', { playerId });
            broadcastRoomUpdate(room.id);
        }
        catch (err) {
            console.error('[Server] Rejoin error:', err);
        }
    });
    /**
     * Join an existing room
     */
    socket.on('join_room', ({ roomId, nickname }) => {
        try {
            const room = store.getRoom(roomId.toUpperCase());
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            if (room.status !== config.GAME_STATUS.LOBBY) {
                socket.emit('error', { message: 'Game already started' });
                return;
            }
            const { player, error } = room.addPlayer(nickname);
            if (error || !player) {
                socket.emit('error', { message: error || 'Failed to add player' });
                return;
            }
            currentRoom = room;
            currentPlayer = player;
            // Map player to socket
            playerSockets.set(player.id, socket.id);
            socket.join(room.id);
            // Clear disconnect timer if rejoining
            if (room.disconnectTimer) {
                clearTimeout(room.disconnectTimer);
                room.disconnectTimer = null;
            }
            socket.emit('room_joined', {
                room: room.toPublicState(),
                player
            });
            // Notify others
            socket.to(room.id).emit('player_joined', { player });
            broadcastRoomUpdate(room.id);
            console.log(`[Server] ${nickname} joined room ${roomId}`);
        }
        catch (err) {
            console.error('[Server] Error joining room:', err);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    /**
     * Rejoin a room after disconnect (Legacy/Manual)
     */
    socket.on('rejoin_room', ({ roomId, nickname }) => {
        try {
            const room = store.getRoom(roomId.toUpperCase());
            if (!room) {
                socket.emit('error', { message: 'Room not found' });
                return;
            }
            // Find player by name (connected or not)
            const existingPlayer = room.players.find(p => p.nickname.toLowerCase() === nickname.toLowerCase());
            if (!existingPlayer) {
                socket.emit('error', { message: 'No player found with that nickname' });
                return;
            }
            // Reconnect
            const { player } = room.addPlayer(nickname, existingPlayer.id);
            if (!player) {
                socket.emit('error', { message: 'Failed to rejoin' });
                return;
            }
            currentRoom = room;
            currentPlayer = player;
            // Map player to socket
            playerSockets.set(player.id, socket.id);
            socket.join(room.id);
            // Clear disconnect timer
            if (room.disconnectTimer) {
                clearTimeout(room.disconnectTimer);
                room.disconnectTimer = null;
            }
            socket.emit('room_joined', {
                room: room.toPublicState(),
                player
            });
            // Send game state if game is playing
            if (room.status === config.GAME_STATUS.PLAYING) {
                const game = room.gameType === 'rummy' ? rummyGames.get(room.id) : chkobbaGames.get(room.id);
                if (game) {
                    socket.emit('game_state', game.getFullState(player.id));
                }
            }
            // Notify others
            socket.to(room.id).emit('player_reconnected', { playerId: player.id });
            broadcastRoomUpdate(room.id);
            console.log(`[Server] ${nickname} rejoined room ${roomId}`);
        }
        catch (err) {
            console.error('[Server] Error rejoining room:', err);
            socket.emit('error', { message: 'Failed to rejoin room' });
        }
    });
    /**
     * Update room settings (Host only)
     */
    socket.on('update_room_settings', ({ maxPlayers, gameType, targetScore, turnTimeout }) => {
        if (!currentRoom || !currentPlayer)
            return;
        if (!currentPlayer.isHost) {
            socket.emit('error', { message: 'Only host can change settings' });
            return;
        }
        const oldMax = currentRoom.maxPlayers;
        const oldType = currentRoom.gameType;
        console.log(`[Server] Updating settings for room ${currentRoom.id}: ${gameType}, ${maxPlayers} players, ${turnTimeout}s timeout`);
        if (maxPlayers < currentRoom.players.length) {
            socket.emit('error', {
                message: 'Too many players in the lobby for this table size. Remove players first, or keep 2v2.',
            });
            return;
        }
        // updateSettings now returns removed human player IDs
        const removedIds = currentRoom.updateSettings(maxPlayers, gameType, targetScore, turnTimeout ?? currentRoom.turnTimeout);
        // Notify and disconnect removed players
        removedIds.forEach(pid => {
            const removedSocket = getSocketByPlayerId(pid);
            if (removedSocket) {
                removedSocket.emit('error', { message: 'Room capacity reduced, you were removed.' });
                removedSocket.leave(currentRoom.id);
                // We'll also tell their frontend to reset (optional if we emit an error they handle)
            }
            playerSockets.delete(pid);
        });
        // If game settings changed, notify everyone via chat
        let changeMsg = `Host updated settings: ${gameType.toUpperCase()}`;
        if (maxPlayers !== oldMax)
            changeMsg += `, ${maxPlayers} players`;
        if (gameType === 'chkobba' && targetScore !== currentRoom.targetScore)
            changeMsg += `, ${targetScore} pts`;
        currentRoom.addChatMessage('system', changeMsg, true);
        io.to(currentRoom.id).emit('chat_message', {
            playerId: 'system',
            playerNickname: 'System',
            message: changeMsg,
            isSystem: true,
            timestamp: Date.now()
        });
        // Clear any games if mode changed drastically
        if (gameType !== oldType || maxPlayers !== oldMax) {
            deleteGames(currentRoom.id);
        }
        broadcastRoomUpdate(currentRoom.id);
    });
    /**
     * Add a bot to the room (Host only, lobby only)
     */
    socket.on('add_bot', () => {
        if (!currentRoom || !currentPlayer)
            return;
        // Re-fetch player from room to ensure we have the latest host status
        const p = currentRoom.players.find(p => p.id === currentPlayer.id);
        if (!p || !p.isHost) {
            socket.emit('error', { message: 'Only host can add bots' });
            return;
        }
        if (currentRoom.status !== config.GAME_STATUS.LOBBY)
            return;
        if (currentRoom.players.length >= currentRoom.maxPlayers) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }
        const existingNames = currentRoom.players.map(p => p.nickname);
        const botName = getRandomBotName(existingNames);
        const bot = {
            id: generatePlayerId(),
            nickname: botName,
            team: currentRoom.calculateTeam(),
            isHost: false,
            isConnected: true,
            isReady: true,
            isBot: true,
            handCount: 0,
            capturedCount: 0,
            chkobbaCount: 0,
            dinariCount: 0,
            sevensCount: 0,
            hasHaya: false,
            wins: 0,
            losses: 0
        };
        currentRoom.players.push(bot);
        currentRoom.lastActivity = Date.now();
        console.log(`[Server] Bot "${botName}" added to room ${currentRoom.id}`);
        broadcastRoomUpdate(currentRoom.id);
    });
    /**
     * Remove a bot from the room (Host only, lobby only)
     */
    socket.on('remove_bot', ({ botId }) => {
        if (!currentRoom || !currentPlayer)
            return;
        // Re-fetch player from room to ensure we have the latest host status
        const p = currentRoom.players.find(p => p.id === currentPlayer.id);
        if (!p || !p.isHost) {
            socket.emit('error', { message: 'Only host can remove bots' });
            return;
        }
        if (currentRoom.status !== config.GAME_STATUS.LOBBY)
            return;
        const botIdx = currentRoom.players.findIndex(p => p.id === botId && p.isBot);
        if (botIdx === -1)
            return;
        currentRoom.players.splice(botIdx, 1);
        currentRoom.lastActivity = Date.now();
        console.log(`[Server] Bot removed from room ${currentRoom.id}`);
        broadcastRoomUpdate(currentRoom.id);
    });
    /**
     * Kick a player or bot (host only, lobby only). Humans receive kicked_by_host.
     */
    socket.on('kick_player', ({ playerId }) => {
        if (!currentRoom || !currentPlayer)
            return;
        const hostP = currentRoom.players.find((p) => p.id === currentPlayer.id);
        if (!hostP?.isHost) {
            socket.emit('error', { message: 'Only the host can remove players' });
            return;
        }
        if (currentRoom.status !== config.GAME_STATUS.LOBBY) {
            socket.emit('error', { message: 'Can only remove players in the lobby' });
            return;
        }
        if (playerId === currentPlayer.id) {
            socket.emit('error', { message: 'You cannot remove yourself' });
            return;
        }
        const target = currentRoom.players.find((p) => p.id === playerId);
        if (!target)
            return;
        if (target.isHost) {
            socket.emit('error', { message: 'Cannot remove the host' });
            return;
        }
        const roomId = currentRoom.id;
        if (target.isBot) {
            const idx = currentRoom.players.findIndex((p) => p.id === playerId && p.isBot);
            if (idx === -1)
                return;
            currentRoom.players.splice(idx, 1);
            currentRoom.lastActivity = Date.now();
            console.log(`[Server] Bot removed from room ${roomId} (kick_player)`);
            broadcastRoomUpdate(roomId);
            return;
        }
        const nickname = target.nickname;
        const targetSocket = getSocketByPlayerId(playerId);
        currentRoom.removePlayer(playerId, true);
        playerSockets.delete(playerId);
        if (targetSocket) {
            targetSocket.leave(roomId);
            targetSocket.emit('kicked_by_host', { playerNickname: nickname });
            const clear = socketSessionCleanups.get(targetSocket.id);
            clear?.();
        }
        io.to(roomId).emit('player_left', { playerId, nickname });
        broadcastRoomUpdate(roomId);
        currentRoom.addChatMessage('system', `${nickname} was removed by the host`, true);
        io.to(roomId).emit('chat_message', {
            playerId: 'system',
            playerNickname: 'System',
            message: `${nickname} was removed by the host`,
            isSystem: true,
            timestamp: Date.now()
        });
        console.log(`[Server] Player ${nickname} kicked from room ${roomId} by host`);
    });
    /**
     * Update player team assignment (Host only, in lobby)
     */
    socket.on('update_player_team', ({ playerId, team }) => {
        if (!currentRoom || !currentPlayer)
            return;
        // Re-fetch player from room to ensure we have the latest host status
        const p = currentRoom.players.find(p => p.id === currentPlayer.id);
        if (!p || !p.isHost) {
            socket.emit('error', { message: 'Only host can change teams' });
            return;
        }
        const targetPlayer = currentRoom.players.find(p => p.id === playerId);
        if (!targetPlayer) {
            socket.emit('error', { message: 'Player not found' });
            return;
        }
        // Validate team assignment
        if (currentRoom.maxPlayers === 2) {
            // 2-player: teams must be 0 and 1
            if (team !== 0 && team !== 1) {
                socket.emit('error', { message: 'Invalid team for 2-player game' });
                return;
            }
        }
        else if (currentRoom.maxPlayers === 4) {
            // 4-player: max 2 players per team, team must be 0 or 1
            if (team !== 0 && team !== 1) {
                socket.emit('error', { message: 'Invalid team' });
                return;
            }
            const currentTeamCount = currentRoom.players.filter(p => p.team === team).length;
            // Don't count the target player if they're already on this team
            const adjustingPlayerCount = targetPlayer.team === team ? currentTeamCount - 1 : currentTeamCount;
            if (adjustingPlayerCount >= 2) {
                socket.emit('error', { message: 'Team is full (max 2 players)' });
                return;
            }
        }
        targetPlayer.team = team;
        broadcastRoomUpdate(currentRoom.id);
        console.log(`[Server] Player ${targetPlayer.nickname} assigned to team ${team} by host`);
    });
    /**
     * Mark player as ready
     */
    socket.on('player_ready', () => {
        if (!currentRoom || !currentPlayer)
            return;
        currentRoom.setReady(currentPlayer.id, true);
        broadcastRoomUpdate(currentRoom.id);
        // Auto-start when room is full and all connected human players are ready (bots are always ready)
        if (currentRoom.players.length === currentRoom.maxPlayers && currentRoom.allPlayersReady()) {
            currentRoom.status = config.GAME_STATUS.PLAYING;
            if (currentRoom.gameType === 'rummy') {
                const game = getOrCreateRummyGame(currentRoom.id, currentRoom);
                game.start();
            }
            else {
                const game = getOrCreateChkobbaGame(currentRoom.id, currentRoom);
                game.start();
            }
            io.to(currentRoom.id).emit('game_started');
            broadcastGameState(currentRoom.id);
            broadcastRoomUpdate(currentRoom.id);
            if (currentRoom.gameType === 'chkobba') {
                scheduleTurnAfterDeal(currentRoom.id);
            }
            console.log(`[Server] Auto-started ${currentRoom.gameType} game in room ${currentRoom.id} (room full and all ready)`);
        }
    });
    /**
     * Start the game (host only)
     */
    socket.on('start_game', () => {
        if (!currentRoom || !currentPlayer)
            return;
        // Re-fetch player from room to ensure we have the latest host status
        const p = currentRoom.players.find(p => p.id === currentPlayer.id);
        if (!p || !p.isHost) {
            socket.emit('error', { message: 'Only host can start game' });
            return;
        }
        if (currentRoom.players.length !== currentRoom.maxPlayers) {
            socket.emit('error', { message: `Need exactly ${currentRoom.maxPlayers} players to start.` });
            return;
        }
        // Create and start game based on game type
        currentRoom.status = config.GAME_STATUS.PLAYING;
        if (currentRoom.gameType === 'rummy') {
            const game = getOrCreateRummyGame(currentRoom.id, currentRoom);
            game.start();
        }
        else {
            const game = getOrCreateChkobbaGame(currentRoom.id, currentRoom);
            game.start();
        }
        io.to(currentRoom.id).emit('game_started');
        broadcastGameState(currentRoom.id);
        broadcastRoomUpdate(currentRoom.id);
        if (currentRoom.gameType === 'chkobba') {
            scheduleTurnAfterDeal(currentRoom.id);
        }
        console.log(`[Server] ${currentRoom.gameType} game started in room ${currentRoom.id}`);
    });
    /**
     * Play a card (Chkobba)
     */
    socket.on('play_card', ({ cardIndex, tableIndices }) => {
        if (!currentRoom || !currentPlayer) {
            socket.emit('error', { message: 'Not connected to a room' });
            return;
        }
        if (currentRoom.gameType !== 'chkobba') {
            socket.emit('error', { message: 'Not a Chkobba game' });
            return;
        }
        const game = chkobbaGames.get(currentRoom.id);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        clearTurnTimer(currentRoom.id); // Cancel AFK timer — player acted
        currentRoom.lastActivity = Date.now();
        const result = game.playCard(currentPlayer.id, cardIndex, tableIndices || []);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }
        broadcastGameState(currentRoom.id);
        if (result.capture?.isChkobba) {
            io.to(currentRoom.id).emit('chkobba', {
                playerId: currentPlayer.id,
                playerNickname: currentPlayer.nickname
            });
        }
        if (result.capture?.isHayya) {
            io.to(currentRoom.id).emit('hayya_captured', {
                playerId: currentPlayer.id,
                playerNickname: currentPlayer.nickname
            });
        }
        // Check if round just ended
        if (game.roundJustEnded && game.lastRoundResult) {
            io.to(currentRoom.id).emit('round_end', game.lastRoundResult);
            if (game.winner) {
                io.to(currentRoom.id).emit('game_over', {
                    winner: game.winner,
                    scores: game.scores
                });
                return;
            }
            // Auto-add all bots to continuePlayers
            for (const p of currentRoom.players) {
                if (p.isBot)
                    game.continuePlayers.add(p.id);
            }
            return; // Wait for humans to click Continue
        }
        if (result.capture?.isChkobba || result.capture?.isHayya) {
            scheduleTurnTimer(currentRoom.id, SPECIAL_CAPTURE_PAUSE_MS);
        }
        else {
            startTurnTimer(currentRoom.id);
        }
    });
    /**
     * Draw card from draw pile (Rummy)
     */
    socket.on('rummy_draw', () => {
        if (!currentRoom || !currentPlayer) {
            socket.emit('error', { message: 'Not connected to a room' });
            return;
        }
        if (currentRoom.gameType !== 'rummy') {
            socket.emit('error', { message: 'Not a Rummy game' });
            return;
        }
        const game = rummyGames.get(currentRoom.id);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        currentRoom.lastActivity = Date.now();
        const result = game.drawCard(currentPlayer.id);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }
        broadcastGameState(currentRoom.id);
    });
    /**
     * Draw card from discard pile (Rummy)
     */
    socket.on('rummy_draw_discard', () => {
        if (!currentRoom || !currentPlayer) {
            socket.emit('error', { message: 'Not connected to a room' });
            return;
        }
        if (currentRoom.gameType !== 'rummy') {
            socket.emit('error', { message: 'Not a Rummy game' });
            return;
        }
        const game = rummyGames.get(currentRoom.id);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        currentRoom.lastActivity = Date.now();
        const result = game.drawFromDiscard(currentPlayer.id);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }
        broadcastGameState(currentRoom.id);
    });
    /**
     * Discard card (Rummy)
     */
    socket.on('rummy_discard', ({ cardIndex }) => {
        if (!currentRoom || !currentPlayer) {
            socket.emit('error', { message: 'Not connected to a room' });
            return;
        }
        if (currentRoom.gameType !== 'rummy') {
            socket.emit('error', { message: 'Not a Rummy game' });
            return;
        }
        const game = rummyGames.get(currentRoom.id);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        currentRoom.lastActivity = Date.now();
        const result = game.discardCard(currentPlayer.id, cardIndex);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }
        broadcastGameState(currentRoom.id);
        // Check if round ended
        if (game.roundJustEnded && game.lastRoundResult) {
            io.to(currentRoom.id).emit('round_end', game.lastRoundResult);
            if (game.winner) {
                // Build penalty scores by team
                const scores = { team0: 0, team1: 0 };
                for (const p of game.players) {
                    if (p.team === 0)
                        scores.team0 += p.penaltyPoints || 0;
                    else
                        scores.team1 += p.penaltyPoints || 0;
                }
                io.to(currentRoom.id).emit('game_over', { winner: game.winner, scores });
                return;
            }
            // Auto-add bots to continue
            for (const p of currentRoom.players) {
                if (p.isBot)
                    game.continuePlayers.add(p.id);
            }
            return;
        }
        startTurnTimer(currentRoom.id);
    });
    /**
     * Lay off a card on an existing meld (Rummy)
     */
    socket.on('rummy_lay_off', ({ meldId, cardIndex }) => {
        if (!currentRoom || !currentPlayer) {
            socket.emit('error', { message: 'Not connected to a room' });
            return;
        }
        if (currentRoom.gameType !== 'rummy') {
            socket.emit('error', { message: 'Not a Rummy game' });
            return;
        }
        const game = rummyGames.get(currentRoom.id);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        currentRoom.lastActivity = Date.now();
        const result = game.layOffCard(currentPlayer.id, meldId, cardIndex);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }
        broadcastGameState(currentRoom.id);
    });
    /**
     * Create meld (Rummy)
     */
    socket.on('rummy_meld', ({ cardIndices, type }) => {
        if (!currentRoom || !currentPlayer) {
            socket.emit('error', { message: 'Not connected to a room' });
            return;
        }
        if (currentRoom.gameType !== 'rummy') {
            socket.emit('error', { message: 'Not a Rummy game' });
            return;
        }
        const game = rummyGames.get(currentRoom.id);
        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }
        currentRoom.lastActivity = Date.now();
        const result = game.createMeld(currentPlayer.id, cardIndices, type);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }
        broadcastGameState(currentRoom.id);
    });
    /**
     * Continue to next round (after round end modal)
     */
    socket.on('continue_round', () => {
        if (!currentRoom || !currentPlayer) {
            socket.emit('error', { message: 'Not connected to a room. Please refresh.' });
            return;
        }
        const game = chkobbaGames.get(currentRoom.id) || rummyGames.get(currentRoom.id);
        if (!game) {
            socket.emit('error', { message: 'Game not found. Please refresh.' });
            return;
        }
        currentRoom.lastActivity = Date.now();
        // Don't start a new round if game is over
        if (game.winner)
            return;
        // Auto-add all bots to continuePlayers
        for (const p of currentRoom.players) {
            if (p.isBot)
                game.continuePlayers.add(p.id);
        }
        // Only wait for connected human players
        const connectedHumanIds = currentRoom.getConnectedPlayers()
            .filter(p => !p.isBot)
            .map(p => p.id);
        const allReady = game.playerContinue(currentPlayer.id, connectedHumanIds);
        if (allReady) {
            game.startNewRound();
            io.to(currentRoom.id).emit('new_round');
            broadcastGameState(currentRoom.id);
            scheduleTurnAfterDeal(currentRoom.id);
        }
    });
    /**
     * Forfeit match
     */
    socket.on('forfeit', () => {
        if (!currentRoom || !currentPlayer)
            return;
        const game = chkobbaGames.get(currentRoom.id) || rummyGames.get(currentRoom.id);
        if (!game)
            return;
        console.log(`[Server] Forfeit by ${currentPlayer.nickname} in room ${currentRoom.id}`);
        // Determine winning team (the other one)
        const winningTeam = currentPlayer.team === 0 ? 1 : 0;
        // Set game winner
        game.winner = {
            team: winningTeam,
            players: currentRoom.getTeam(winningTeam).map(p => p.nickname),
            reason: 'forfeit'
        };
        // Update session wins/losses
        currentRoom.players.forEach(p => {
            if (p.team === winningTeam) {
                p.wins = (p.wins || 0) + 1;
            }
            else {
                p.losses = (p.losses || 0) + 1;
            }
        });
        // Notify everyone
        io.to(currentRoom.id).emit('game_over', {
            winner: game.winner,
            scores: game.scores || {}
        });
        broadcastGameState(currentRoom.id);
        broadcastRoomUpdate(currentRoom.id);
    });
    /**
     * Play again (reset scores and start new match immediately)
     */
    socket.on('play_again', () => {
        if (!currentRoom || !currentPlayer)
            return;
        clearTurnTimer(currentRoom.id);
        // Clear the current game data
        chkobbaGames.delete(currentRoom.id);
        rummyGames.delete(currentRoom.id);
        // Start a fresh game in same room, respecting current game type
        if (currentRoom.gameType === 'rummy') {
            const newGame = getOrCreateRummyGame(currentRoom.id, currentRoom);
            newGame.start();
        }
        else {
            const newGame = getOrCreateChkobbaGame(currentRoom.id, currentRoom);
            newGame.start();
        }
        io.to(currentRoom.id).emit('game_started');
        broadcastGameState(currentRoom.id);
        if (currentRoom.gameType === 'chkobba') {
            scheduleTurnAfterDeal(currentRoom.id);
        }
        console.log(`[Server] Room ${currentRoom.id} started a new ${currentRoom.gameType} match (Play Again)`);
    });
    /**
     * Reset game (play again in same room)
     */
    socket.on('reset_game', () => {
        if (!currentRoom || !currentPlayer) {
            console.log('[Server] reset_game failed: No currentRoom or currentPlayer');
            return;
        }
        console.log(`[Server] Resetting game for room ${currentRoom.id} (triggered by ${currentPlayer.nickname})`);
        clearTurnTimer(currentRoom.id);
        // Reset room status but KEEP players and their wins/losses
        currentRoom.status = config.GAME_STATUS.LOBBY;
        for (const player of currentRoom.players) {
            player.isReady = false;
        }
        // Delete existing game instance
        chkobbaGames.delete(currentRoom.id);
        rummyGames.delete(currentRoom.id);
        // Notify ALL players to clear their game states and return to lobby
        io.to(currentRoom.id).emit('lobby_reset');
        // Also broadcast the room update so players see everyone is unready
        broadcastRoomUpdate(currentRoom.id);
    });
    /**
     * Reset lobby (legacy)
     */
    socket.on('reset_lobby', () => {
        if (!currentRoom || !currentPlayer)
            return;
        // Delete the game instance(s)
        deleteGames(currentRoom.id);
        // Reset room to lobby state
        currentRoom.status = config.GAME_STATUS.LOBBY;
        for (const player of currentRoom.players) {
            player.isReady = false;
        }
        io.to(currentRoom.id).emit('lobby_reset');
        broadcastRoomUpdate(currentRoom.id);
    });
    /**
     * Send chat message
     */
    socket.on('chat_message', ({ message }) => {
        if (!currentRoom || !currentPlayer)
            return;
        const sanitizedMessage = message.slice(0, 200).trim();
        if (!sanitizedMessage)
            return;
        currentRoom.addChatMessage(currentPlayer.id, sanitizedMessage, false);
        io.to(currentRoom.id).emit('chat_message', {
            playerId: currentPlayer.id,
            playerNickname: currentPlayer.nickname,
            message: sanitizedMessage,
            timestamp: Date.now()
        });
    });
    /**
     * Sound emote — broadcast to room (cooldown per player)
     */
    socket.on('game_emote', ({ emoteId }) => {
        if (!currentRoom || !currentPlayer)
            return;
        if (!isValidGameEmoteId(emoteId))
            return;
        const key = `${currentRoom.id}:${currentPlayer.id}`;
        const now = Date.now();
        const prev = lastGameEmoteAt.get(key) ?? 0;
        if (now - prev < GAME_EMOTE_COOLDOWN_MS)
            return;
        lastGameEmoteAt.set(key, now);
        io.to(currentRoom.id).emit('game_emote', {
            playerId: currentPlayer.id,
            emoteId,
        });
    });
    /**
     * DEBUG: Force win
     */
    socket.on('debug_force_win', () => {
        if (!currentRoom || !currentPlayer)
            return;
        const game = chkobbaGames.get(currentRoom.id);
        if (!game)
            return;
        console.log(`[DEBUG] Force win triggered by ${currentPlayer.nickname} for team ${currentPlayer.team}`);
        game.forceWin(currentPlayer.team);
        io.to(currentRoom.id).emit('game_over', {
            winner: game.winner,
            scores: game.scores
        });
        broadcastGameState(currentRoom.id);
    });
    /**
     * Leave room (Permanent)
     */
    socket.on('leave_room', () => {
        if (!currentRoom || !currentPlayer)
            return;
        const playerId = currentPlayer.id;
        const nickname = currentPlayer.nickname;
        const wasHost = currentPlayer.isHost;
        const roomId = currentRoom.id;
        console.log(`[Server] Player ${nickname} is leaving room ${roomId} permanently`);
        // 1. Leave the socket room immediately so we don't receive the broadcasts we're about to send
        socket.leave(roomId);
        // 2. Remove player permanently from data store
        currentRoom.removePlayer(playerId, true);
        playerSockets.delete(playerId);
        // 3. If host left, we MUST reset the room to lobby so new host can manage it
        if (wasHost) {
            currentRoom.status = config.GAME_STATUS.LOBBY;
            // Clear any active games
            deleteGames(roomId);
            // Notify everyone left about the host change and reset
            io.to(roomId).emit('lobby_reset');
            const newHost = currentRoom.players.find(p => p.isHost && p.isConnected);
            if (newHost) {
                const hostSocket = getSocketByPlayerId(newHost.id);
                if (hostSocket) {
                    hostSocket.emit('error', { message: 'The host left. You are now the host!' });
                }
            }
            // CRITICAL: Broadcast the update so the clients see the new hostId
            broadcastRoomUpdate(roomId);
        }
        // 4. Notify others
        socket.to(roomId).emit('player_left', { playerId, nickname });
        broadcastRoomUpdate(roomId);
        // 5. Add system message to chat
        currentRoom.addChatMessage('system', `${nickname} left the room`, true);
        io.to(roomId).emit('chat_message', {
            playerId: 'system',
            playerNickname: 'System',
            message: `${nickname} left the room`,
            isSystem: true,
            timestamp: Date.now()
        });
        currentRoom = null;
        currentPlayer = null;
    });
    /**
     * Handle player disconnect
     */
    socket.on('disconnect', () => {
        console.log(`[Server] Client disconnected: ${socket.id}`);
        socketSessionCleanups.delete(socket.id);
        if (currentPlayer) {
            // ONLY process disconnect if this socket is still the one assigned to the player
            // This prevents rapid refreshes from clearing the state of the new connection
            if (playerSockets.get(currentPlayer.id) === socket.id) {
                console.log(`[Server] Cleaning up session for ${currentPlayer.nickname} (${currentPlayer.id})`);
                playerSockets.delete(currentPlayer.id);
                if (currentRoom) {
                    handleDisconnect(socket, currentRoom, currentPlayer);
                }
            }
            else {
                console.log(`[Server] Disconnect ignored for ${currentPlayer.nickname} (old ghost socket)`);
            }
        }
        currentRoom = null;
        currentPlayer = null;
    });
});
// SPA fallback — serve index.html for all non-API/socket routes
app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});
// Start cleanup timer
store.startCleanupTimer();
// Start server
server.listen(config.PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║   🃏 Chkobba Server Running               ║
║                                           ║
║   Port: ${config.PORT}${' '.repeat(27 - String(config.PORT).length)}║
║   Environment: ${config.NODE_ENV}${' '.repeat(20 - String(config.NODE_ENV).length)}║
║                                           ║
║   Open http://localhost:${config.PORT}        ║
║                                           ║
╚═══════════════════════════════════════════╝
  `);
});
export { app, server, io };
