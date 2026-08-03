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

const mongoose = require('mongoose');
mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected! Emitting system_status_warning.');
    io.emit('system_status_warning', { message: 'Database connection lost. Game paused automatically.' });
});
mongoose.connection.on('reconnected', () => {
    console.info('[DB] MongoDB reconnected. Emitting system_status_ok.');
    io.emit('system_status_ok', { message: 'Database connection restored.' });
});

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
        const sId = String(sessionId);
        const state = await ensureActiveGame(sId, io);
        
        if (!state) {
            socket.emit('game_deleted');
            return;
        }

        socket.join(sId);
        socket.sessionId = sId;
        socket.ticketCode = ticketCode;
        if (role === 'player' && ticketCode) {
            socket.join(ticketCode);
            if (activeGames[sId]) {
                activeGames[sId].onlinePlayers.add(ticketCode);
            }
            io.to(sId).emit('player_joined_status', { ticketCode, status: 'PLAYING' });
        }
        
        if (activeGames[sId]) {
            const game = await GameSession.findById(sId);
            const totalPlayers = game ? game.totalPlayers : 0;
            io.to(sId).emit('player_count_update', {
                onlineCount: activeGames[sId].onlinePlayers.size,
                totalPlayers: totalPlayers
            });
        }
        
        if (activeGames[sId]) {
            const game = await GameSession.findById(sId);
            const status = game ? game.gameStatus : 'WAITING';
            const state = activeGames[sId];
            
            let markedNums = [];
            if (role === 'player' && ticketCode) {
                const t = await Ticket.findOne({ ticketCode, sessionId: sId });
                if (t) markedNums = t.markedNumbers;
            }

            const defaultPrizes = [
                { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null, prizeItem: null, sponsor: null },
                { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null, prizeItem: null, sponsor: null },
                { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null, prizeItem: null, sponsor: null },
                { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null, prizeItem: null, sponsor: null },
                { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, enabled: true, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null, prizeItem: null, sponsor: null }
            ];
            
            const sessionPrizes = game && game.prizes && game.prizes.length > 0 ? game.prizes : defaultPrizes;

            socket.emit('game_sync', {
                status: status,
                currentNumber: activeGames[sId].drawnNumbers.slice(-1)[0] || null,
                drawnNumbers: activeGames[sId].drawnNumbers,
                prizes: sessionPrizes,
                markedNumbers: markedNums,
                remainingNumbers: activeGames[sId].availableNumbers.length,
                tickId: activeGames[sId].tickId
            });

            // Hydrate activePauseInfo from DB on boot if missing
            if (status === 'PAUSED' && !activePauseInfo[sId] && game && game.pauseState) {
                activePauseInfo[sId] = game.pauseState;
                // Restart the countdown broadcast loop for admins/late joiners if it was dead
                let countdown = activePauseInfo[sId].countdown;
                const currentWinner = activePauseInfo[sId].currentWinner;
                const intervalId = setInterval(() => {
                    countdown--;
                    activePauseInfo[sId].countdown = countdown;
                    io.to(sId).emit('pause_countdown_tick', { countdown, currentWinner });
                    
                    if (countdown <= 0) {
                        clearInterval(intervalId);
                        resumeGame(sId, io).catch(err => console.error("Auto-resume error:", err));
                        delete activePauseInfo[sId];
                    }
                }, 1000);
            }

            // Reconnect during pause: restore current winner + remaining countdown immediately
            if (status === 'PAUSED' && activePauseInfo[sId]) {
                const { countdown, currentWinner } = activePauseInfo[sId];
                if (countdown > 1) {
                    console.log(`[PAUSE] restore on join session=${sId} countdown=${countdown}`);
                    socket.emit('game_paused', { status: 'PAUSED', countdown, currentWinner });
                    socket.emit('pause_countdown_tick', { countdown, currentWinner });
                }
            }
        }
    });

    socket.on('mark_number', async ({ sessionId, ticketCode, number }) => {
        const sId = String(sessionId);
        const state = await ensureActiveGame(sId, io);
        if (!state) return;
        if (!state.drawnNumbers.includes(number)) return;

        try {
            const ticket = await Ticket.findOneAndUpdate(
                { ticketCode, sessionId: sId },
                { $addToSet: { markedNumbers: number } },
                { new: true }
            );
            if (ticket) {
                socket.emit('number_marked', { number });
                // Broadcast to other devices viewing the same ticket
                socket.to(ticketCode).emit('ticket_marked', { number });
            } else {
                socket.emit('mark_error', { number, message: 'Ticket not found or invalid session.' });
            }
        } catch (err) {
            console.error(`[SOCKET] mark_error:`, err);
            socket.emit('mark_error', { number, message: 'Server error processing mark.' });
        }
    });

    socket.on('claim_prize', async ({ sessionId, ticketCode, prizeId }, callback) => {
        const sId = String(sessionId);
        const state = activeGames[sId];
        
        const sendError = (msg) => {
            if (typeof callback === 'function') callback({ success: false, message: msg });
            else socket.emit('claim_result', { success: false, message: msg });
        };

        if (!state) return sendError('Game not active');

        if (!state.claimLocks) state.claimLocks = {};
        if (state.claimLocks[prizeId]) return sendError('Another player is claiming this prize');
        state.claimLocks[prizeId] = true;
        console.log(`[CLAIM] received session=${sId} prize=${prizeId} ticket=${ticketCode}`);

        try {
            const mongoose = require('mongoose');
            const dbSession = await mongoose.startSession();
            try {
                dbSession.startTransaction();
                
                const game = await GameSession.findById(sId).session(dbSession);
                if (!game || game.gameStatus !== 'LIVE') {
                    await dbSession.abortTransaction();
                    dbSession.endSession();
                    return sendError('Game is not LIVE');
                }

                const defaultPrizes = [
                    { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null, prizeItem: null, sponsor: null },
                    { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null, prizeItem: null, sponsor: null },
                    { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null, prizeItem: null, sponsor: null },
                    { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null, prizeItem: null, sponsor: null },
                    { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, enabled: true, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null, prizeItem: null, sponsor: null }
                ];

                const sessionPrizes = game.prizes && game.prizes.length > 0 ? game.prizes : defaultPrizes;

                const prizeIndex = sessionPrizes.findIndex(p => p.id === prizeId);
                if (prizeIndex === -1) {
                    await dbSession.abortTransaction();
                    dbSession.endSession();
                    return sendError('Prize not found');
                }
                
                const prize = sessionPrizes[prizeIndex];
                
                if (prize.status !== 'AVAILABLE') {
                    await dbSession.abortTransaction();
                    dbSession.endSession();
                    return sendError('Prize is not available');
                }

                const hasWonSameCategory = game.prizes && game.prizes.some(p => p.type === prize.type && p.winnerTicket === ticketCode);
                if (hasWonSameCategory) {
                    await dbSession.abortTransaction();
                    dbSession.endSession();
                    return sendError('You have already claimed a prize in this category');
                }

                const ticket = await Ticket.findOne({ ticketCode, sessionId: sId }).session(dbSession);
                if (!ticket) {
                    await dbSession.abortTransaction();
                    dbSession.endSession();
                    return sendError('Ticket not found');
                }

                const isValid = validateClaim(prize.type, ticket.ticketMatrix, state.drawnNumbers, ticket.markedNumbers);
                console.log(`[CLAIM] validate prizeType=${prize.type} prizeId=${prize.id} valid=${isValid}`);

                if (isValid) {
                    // 1. Stop the game timer immediately to prevent race conditions
                    state.timerLock = true;
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

                    state.winners[prize.name] = { ticketCode, playerName: ticket.playerName || 'Player' };
                    if (game.prizes && game.prizes.length > 0) {
                        game.stateVersion = (game.stateVersion || 0) + 1;
                        await game.save({ session: dbSession });
                    }

                    const newWinner = new Winner({ sessionId: sId, prizeType: prize.name, ticketCode });
                    await newWinner.save({ session: dbSession });
                    
                    await dbSession.commitTransaction();
                    dbSession.endSession();
                    
                    console.log(`[CLAIM] winner saved session=${sId} prize=${prize.name} ticket=${ticketCode}`);
                    
                    // Ensure claimer is in the normalized room
                    socket.join(sId);

                    const claimPayload = {
                        success: true,
                        message: `🎉 ${ticket.playerName || 'Player'} (${ticketCode}) won ${prize.name}!`,
                        prizeId: prize.id || prize.type || prize.name,
                        prizeName: prize.name,
                        winnerTicket: ticketCode,
                        winnerName: ticket.playerName || 'Player', 
                        prizeItem: prize.prizeItem || null,
                        sponsor: prize.sponsor || null
                    };

                    // Log room membership so we can verify every client is targeted
                    try {
                        const roomSockets = await io.in(sId).fetchSockets();
                        console.log(`[CLAIM] claim_result emit room=${sId} sockets=${roomSockets.length} ids=${roomSockets.map(s => s.id).join(',')}`);
                    } catch (e) {
                        console.warn('[CLAIM] fetchSockets failed', e?.message || e);
                    }

                    io.to(sId).emit('claim_result', claimPayload);
                    console.log(`[CLAIM] claim_result emitted session=${sId}`, JSON.stringify(claimPayload));
                    io.to(sId).emit('game_sync', {
                        status: game.gameStatus,
                        currentNumber: activeGames[sId].drawnNumbers.slice(-1)[0] || null,
                        drawnNumbers: activeGames[sId].drawnNumbers,
                        prizes: sessionPrizes,
                        remainingNumbers: activeGames[sId].availableNumbers.length
                    });

                    // Let Socket.IO flush claim_result to all clients before pause/countdown
                    await new Promise(resolve => setImmediate(resolve));
                    await new Promise(resolve => setImmediate(resolve));

                    // Sequential 10-Second Pause Logic for Popups — always keyed by sId
                    if (!pauseQueues[sId]) pauseQueues[sId] = [];
                    
                    const currentWinnerData = {
                        prizeId: prize.id || prize.type || prize.name,
                        prizeName: prize.name,
                        winnerTicket: ticketCode,
                        winnerName: ticket.playerName || 'Player',
                        prizeItem: prize.prizeItem || null,
                        sponsor: prize.sponsor || null
                    };
                    pauseQueues[sId].push(currentWinnerData);

                    if (!pauseProcessing[sId]) {
                        pauseProcessing[sId] = true;
                        const processPauseQueue = async () => {
                            while (pauseQueues[sId] && pauseQueues[sId].length > 0) {
                                const currentWinner = pauseQueues[sId][0];
                                
                                clearPauseTimer(sId);

                                let countdown = 5;
                                activePauseInfo[sId] = { countdown, currentWinner };

                                try {
                                    const liveCheck = await GameSession.findById(sId);
                                    if (liveCheck && liveCheck.gameStatus === 'LIVE') {
                                        await pauseGame(sId, io, { status: 'PAUSED', countdown, currentWinner });
                                        console.log(`[PAUSE] started session=${sId}`);
                                    } else {
                                        io.to(sId).emit('game_paused', { status: 'PAUSED', countdown, currentWinner });
                                    }
                                } catch (e) {
                                    console.warn('[PAUSE] pauseGame skipped/failed:', e?.message || e);
                                    io.to(sId).emit('game_paused', { status: 'PAUSED', countdown, currentWinner });
                                }
                                state.timerLock = false;

                                console.log(`[PAUSE] game_paused emitted session=${sId}`, currentWinner.prizeName);
                                io.to(sId).emit('pause_countdown_tick', { countdown, currentWinner });
                                console.log(`[PAUSE] countdown tick session=${sId} countdown=${countdown}`);
                                
                                await new Promise(resolve => {
                                    activePauseTimers[sId] = setInterval(() => {
                                        countdown--;
                                        if (countdown >= 0) {
                                            activePauseInfo[sId] = { countdown, currentWinner };
                                            io.to(sId).emit('pause_countdown_tick', { countdown, currentWinner });
                                            console.log(`[PAUSE] countdown tick session=${sId} countdown=${countdown}`);
                                        } else {
                                            clearPauseTimer(sId);
                                            resolve();
                                        }
                                    }, 1000);
                                });
                                
                                pauseQueues[sId].shift();
                            }
                            
                            delete activePauseInfo[sId];
                            pauseProcessing[sId] = false;
                            console.log(`[PAUSE] ended session=${sId}`);
                            
                            try {
                                const checkGame = await GameSession.findById(sId);
                                if (checkGame && checkGame.gameStatus === 'PAUSED') {
                                    await resumeGame(sId, io);
                                    console.log(`[PAUSE] game_resumed emitted session=${sId}`);
                                }
                            } catch (e) {
                                console.error('Failed to auto-resume:', e);
                            }
                        };
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
