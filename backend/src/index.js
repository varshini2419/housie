require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const Ticket = require('./models/Ticket');
const Winner = require('./models/Winner');
const GameSession = require('./models/GameSession');
const { validateClaim } = require('./utils/prizeValidator');

if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
    process.exit(1);
}

connectDB();

const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        
        const allowed = [
            'http://localhost:5173',
            'http://127.0.0.1:5173'
        ];
        
        if (process.env.FRONTEND_URL) {
            allowed.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
        }

        if (allowed.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(server, {
    cors: { 
        origin: corsOptions.origin, 
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true
    }
});
app.set('io', io);

const { activeGames, ensureActiveGame, pauseGame, resumeGame, triggerCountdown } = require('./utils/gameEngine');

const pauseQueues = {};
const pauseProcessing = {};
const activePauseTimers = {};
const activePauseInfo = {};

const clearPauseTimer = (sessionId) => {
    if (activePauseTimers[sessionId]) {
        clearInterval(activePauseTimers[sessionId]);
        activePauseTimers[sessionId] = null;
    }
};

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    socket.on('join_game', async ({ sessionId, ticketCode, role }) => {
        const state = await ensureActiveGame(sessionId, io);
        const roomId = String(sessionId);
        socket.join(roomId);
        socket.sessionId = roomId;
        socket.ticketCode = ticketCode;
        
        if (role === 'player' && ticketCode) {
            if (activeGames[sessionId]) {
                activeGames[sessionId].onlinePlayers.add(ticketCode);
            }
            io.to(roomId).emit('player_joined_status', { ticketCode, status: 'PLAYING' });
        }
        
        if (activeGames[sessionId]) {
            const game = await GameSession.findById(sessionId);
            const totalPlayers = game ? game.totalPlayers : 0;
            io.to(roomId).emit('player_count_update', {
                onlineCount: activeGames[sessionId].onlinePlayers.size,
                totalPlayers: totalPlayers
            });
        }
        
        if (activeGames[sessionId]) {
            const game = await GameSession.findById(sessionId);
            const status = game ? game.gameStatus : 'WAITING';
            const state = activeGames[sessionId];
            
            let markedNums = [];
            if (role === 'player' && ticketCode) {
                const t = await Ticket.findOne({ ticketCode, sessionId });
                if (t) markedNums = t.markedNumbers;
            }

            const defaultPrizes = [
                { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null, prizeItem: null },
                { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null, prizeItem: null },
                { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null, prizeItem: null },
                { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null, prizeItem: null },
                { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, enabled: true, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null, prizeItem: null }
            ];
            
            const sessionPrizes = game && game.prizes && game.prizes.length > 0 ? game.prizes : defaultPrizes;

            socket.emit('game_sync', {
                status: status,
                currentNumber: activeGames[sessionId].drawnNumbers.slice(-1)[0] || null,
                drawnNumbers: activeGames[sessionId].drawnNumbers,
                prizes: sessionPrizes,
                markedNumbers: markedNums,
                remainingNumbers: activeGames[sessionId].availableNumbers.length
            });

            // Reconnect during pause: restore current winner + remaining countdown immediately
            if (status === 'PAUSED' && activePauseInfo[sessionId]) {
                const { countdown, currentWinner } = activePauseInfo[sessionId];
                console.log(`[PAUSE] restore on join session=${roomId} countdown=${countdown}`);
                socket.emit('game_paused', { status: 'PAUSED', countdown, currentWinner });
                socket.emit('pause_countdown_tick', { countdown, currentWinner });
            }
        }
    });

    socket.on('mark_number', async ({ sessionId, ticketCode, number }) => {
        const state = await ensureActiveGame(sessionId, io);
        if (!state) return;
        if (!state.drawnNumbers.includes(number)) return;

        try {
            const ticket = await Ticket.findOneAndUpdate(
                { ticketCode, sessionId },
                { $addToSet: { markedNumbers: number } },
                { new: true }
            );
            if (ticket) {
                socket.emit('number_marked', { number });
            }
        } catch (err) {
            console.error('Error marking number:', err);
        }
    });

    socket.on('claim_prize', async ({ sessionId, ticketCode, prizeId }) => {
        const state = activeGames[sessionId];
        if (!state) return socket.emit('claim_result', { success: false, message: 'Game not active' });

        if (!state.claimLocks) state.claimLocks = {};
        if (state.claimLocks[prizeId]) return socket.emit('claim_result', { success: false, message: 'Another player is claiming this prize' });
        state.claimLocks[prizeId] = true;
        console.log(`[CLAIM] received session=${sessionId} prize=${prizeId} ticket=${ticketCode}`);

        try {
            const game = await GameSession.findById(sessionId);
            if (!game || game.gameStatus !== 'LIVE') {
                return socket.emit('claim_result', { success: false, message: 'Game is not LIVE' });
            }

            const defaultPrizes = [
                { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null, prizeItem: null },
                { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null, prizeItem: null },
                { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null, prizeItem: null },
                { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null, prizeItem: null },
                { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, enabled: true, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null, prizeItem: null }
            ];

            const sessionPrizes = game.prizes && game.prizes.length > 0 ? game.prizes : defaultPrizes;

            const prizeIndex = sessionPrizes.findIndex(p => p.id === prizeId);
            if (prizeIndex === -1) return socket.emit('claim_result', { success: false, message: 'Prize not found' });
            
            const prize = sessionPrizes[prizeIndex];
            
            if (prize.status !== 'AVAILABLE') {
                return socket.emit('claim_result', { success: false, message: 'Prize is not available' });
            }

            // Duplicate winner validation for same category
            const hasWonSameCategory = game.prizes && game.prizes.some(p => p.type === prize.type && p.winnerTicket === ticketCode);
            if (hasWonSameCategory) {
                return socket.emit('claim_result', { success: false, message: 'You have already claimed a prize in this category' });
            }

            try {
                const ticket = await Ticket.findOne({ ticketCode, sessionId });
                if (!ticket) return socket.emit('claim_result', { success: false, message: 'Ticket not found' });

                const isValid = validateClaim(prize.type, ticket.ticketMatrix, state.drawnNumbers, ticket.markedNumbers);
                console.log(`[CLAIM] validate prizeType=${prize.type} prizeId=${prize.id} valid=${isValid}`);

                if (isValid) {
                    // 1. Stop the game timer immediately to prevent race conditions
                    if (state.timerId) {
                        clearTimeout(state.timerId);
                        state.timerId = null;
                    }

                    // Update prize status
                    sessionPrizes[prizeIndex].status = 'COMPLETED';
                    sessionPrizes[prizeIndex].winner = ticket.playerName || 'Player';
                    sessionPrizes[prizeIndex].winnerTicket = ticketCode;
                    sessionPrizes[prizeIndex].claimedAt = new Date();
                    
                    // Unlock next prize in sequence
                    const nextSequence = prize.sequence + 1;
                    const nextPrizeIndex = sessionPrizes.findIndex(p => p.type === prize.type && p.sequence === nextSequence);
                    if (nextPrizeIndex !== -1) {
                        sessionPrizes[nextPrizeIndex].status = 'AVAILABLE';
                    }

                    if (game.prizes && game.prizes.length > 0) {
                        await game.save();
                    } else {
                        // For legacy games, update state.winners to maintain backward compatibility
                        state.winners[prize.name] = { ticketCode, playerName: ticket.playerName || 'Player' };
                    }

                    const newWinner = new Winner({ sessionId, prizeType: prize.name, ticketCode });
                    await newWinner.save();
                    console.log(`[CLAIM] winner saved session=${sessionId} prize=${prize.name} ticket=${ticketCode}`);
                    
                    const claimPayload = {
                        success: true,
                        message: `🎉 ${ticket.playerName || 'Player'} (${ticketCode}) won ${prize.name}!`,
                        prizeId: prize.id,
                        prizeName: prize.name,
                        winnerTicket: ticketCode,
                        winnerName: ticket.playerName || 'Player', 
                        prizeItem: prize.prizeItem || null 
                    };
                    io.to(String(sessionId)).emit('claim_result', claimPayload);
                    console.log(`[CLAIM] claim_result emitted session=${sessionId}`, JSON.stringify(claimPayload));
                    io.to(String(sessionId)).emit('game_sync', {
                        status: game.gameStatus,
                        currentNumber: activeGames[sessionId].drawnNumbers.slice(-1)[0] || null,
                        drawnNumbers: activeGames[sessionId].drawnNumbers,
                        prizes: sessionPrizes,
                        remainingNumbers: activeGames[sessionId].availableNumbers.length
                    });

                    // Let Socket.IO flush claim_result to all clients before pause/countdown
                    await new Promise(resolve => setImmediate(resolve));
                    await new Promise(resolve => setImmediate(resolve));

                    // Sequential 10-Second Pause Logic for Popups
                    if (!pauseQueues[sessionId]) pauseQueues[sessionId] = [];
                    
                    const currentWinnerData = {
                        prizeId: prize.id,
                        prizeName: prize.name,
                        winnerTicket: ticketCode,
                        winnerName: ticket.playerName || 'Player',
                        prizeItem: prize.prizeItem || null
                    };
                    pauseQueues[sessionId].push(currentWinnerData);

                    if (!pauseProcessing[sessionId]) {
                        pauseProcessing[sessionId] = true;
                        const processPauseQueue = async () => {
                            const roomId = String(sessionId);
                            while (pauseQueues[sessionId] && pauseQueues[sessionId].length > 0) {
                                const currentWinner = pauseQueues[sessionId][0];
                                
                                try {
                                    const liveCheck = await GameSession.findById(sessionId);
                                    if (liveCheck && liveCheck.gameStatus === 'LIVE') {
                                        await pauseGame(sessionId, io);
                                        console.log(`[PAUSE] started session=${sessionId}`);
                                    }
                                } catch (e) {
                                    // Ignore if already paused — still emit countdown so UI shows
                                    console.warn('[PAUSE] pauseGame skipped/failed:', e?.message || e);
                                }
                                
                                clearPauseTimer(sessionId);

                                let countdown = 10;
                                activePauseInfo[sessionId] = { countdown, currentWinner };
                                // Always emit winner+countdown so every client can show the popup
                                io.to(roomId).emit('game_paused', {
                                    status: 'PAUSED',
                                    countdown,
                                    currentWinner
                                });
                                console.log(`[PAUSE] game_paused emitted session=${roomId}`, currentWinner.prizeName);
                                io.to(roomId).emit('pause_countdown_tick', { countdown, currentWinner });
                                console.log(`[PAUSE] countdown tick session=${roomId} countdown=${countdown}`);
                                
                                await new Promise(resolve => {
                                    activePauseTimers[sessionId] = setInterval(() => {
                                        countdown--;
                                        if (countdown >= 0) {
                                            activePauseInfo[sessionId] = { countdown, currentWinner };
                                            io.to(roomId).emit('pause_countdown_tick', { countdown, currentWinner });
                                            console.log(`[PAUSE] countdown tick session=${roomId} countdown=${countdown}`);
                                        } else {
                                            clearPauseTimer(sessionId);
                                            resolve();
                                        }
                                    }, 1000);
                                });
                                
                                pauseQueues[sessionId].shift();
                            }
                            
                            delete activePauseInfo[sessionId];
                            pauseProcessing[sessionId] = false;
                            console.log(`[PAUSE] ended session=${sessionId}`);
                            
                            // Finished all queued pauses
                            try {
                                const checkGame = await GameSession.findById(sessionId);
                                if (checkGame && checkGame.gameStatus === 'PAUSED') {
                                    await resumeGame(sessionId, io);
                                    console.log(`[PAUSE] game_resumed emitted session=${sessionId}`);
                                }
                            } catch (e) {
                                console.error('Failed to auto-resume:', e);
                            }
                        };
                        // Defer so claim_result delivery is not delayed by pause setup
                        setImmediate(() => processPauseQueue());
                    }

                } else {
                    socket.emit('claim_result', { success: false, message: `Invalid ${prize.name} claim. Please verify your marked numbers.` });
                }
            } catch (err) {
                console.error(err);
                socket.emit('claim_result', { success: false, message: 'Server error processing claim' });
            }
        } finally {
            state.claimLocks[prizeId] = false;
        }
    });

    socket.on('disconnect', async () => {
        if (socket.sessionId && activeGames[socket.sessionId] && socket.ticketCode) {
            activeGames[socket.sessionId].onlinePlayers.delete(socket.ticketCode);
            
            const game = await GameSession.findById(socket.sessionId);
            const totalPlayers = game ? game.totalPlayers : 0;
            
            io.to(socket.sessionId).emit('player_count_update', {
                onlineCount: activeGames[socket.sessionId].onlinePlayers.size,
                totalPlayers: totalPlayers
            });
        }
        console.log(`Client disconnected: ${socket.id}`);
    });

    socket.on('speech_finished', ({ sessionId }) => {
        triggerCountdown(sessionId, io);
    });
});

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/game', require('./routes/gameRoutes'));
app.use('/api/player', require('./routes/playerRoutes'));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
