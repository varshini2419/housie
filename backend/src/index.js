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

const { activeGames, ensureActiveGame, pauseGame, resumeGame } = require('./utils/gameEngine');

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    socket.on('join_game', async ({ sessionId, ticketCode, role }) => {
        const state = await ensureActiveGame(sessionId, io);
        socket.join(sessionId);
        socket.sessionId = sessionId;
        socket.ticketCode = ticketCode;
        
        if (role === 'player' && ticketCode) {
            if (activeGames[sessionId]) {
                activeGames[sessionId].onlinePlayers.add(ticketCode);
            }
            io.to(sessionId).emit('player_joined_status', { ticketCode, status: 'PLAYING' });
        }
        
        if (activeGames[sessionId]) {
            const game = await GameSession.findById(sessionId);
            const totalPlayers = game ? game.totalPlayers : 0;
            io.to(sessionId).emit('player_count_update', {
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
                { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null },
                { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null },
                { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null },
                { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null },
                { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null }
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
        }
    });

    socket.on('mark_number', async ({ sessionId, ticketCode, number }) => {
        const state = await ensureActiveGame(sessionId, io);
        if (!state) return;
        if (!state.drawnNumbers.includes(number)) return;

        try {
            const ticket = await Ticket.findOne({ ticketCode, sessionId });
            if (ticket && !ticket.markedNumbers.includes(number)) {
                ticket.markedNumbers.push(number);
                await ticket.save();
                socket.emit('number_marked', { number });
            }
        } catch (err) {
            console.error('Error marking number:', err);
        }
    });

    socket.on('claim_prize', async ({ sessionId, ticketCode, prizeId }) => {
        const state = activeGames[sessionId];
        if (!state) return socket.emit('claim_result', { success: false, message: 'Game not active' });

        const game = await GameSession.findById(sessionId);
        if (!game || game.gameStatus !== 'LIVE') {
            return socket.emit('claim_result', { success: false, message: 'Game is not LIVE' });
        }

        const defaultPrizes = [
            { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null },
            { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null },
            { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null },
            { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null },
            { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null }
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

            if (isValid) {
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
                
                io.to(sessionId).emit('claim_result', {
                    success: true,
                    message: `🎉 ${ticket.playerName || 'Player'} (${ticketCode}) won ${prize.name}!`,
                    prizeId: prize.id,
                    winnerTicket: ticketCode,
                    winnerName: ticket.playerName || 'Player'
                });

                io.to(sessionId).emit('game_sync', {
                    status: game.gameStatus,
                    currentNumber: activeGames[sessionId].drawnNumbers.slice(-1)[0] || null,
                    drawnNumbers: activeGames[sessionId].drawnNumbers,
                    prizes: sessionPrizes,
                    remainingNumbers: activeGames[sessionId].availableNumbers.length
                });

                // 10-Second Synchronized Pause Logic
                try {
                    await pauseGame(sessionId, io);
                    
                    let countdown = 10;
                    io.to(sessionId).emit('pause_countdown_tick', { countdown });
                    
                    const intervalId = setInterval(() => {
                        countdown--;
                        if (countdown > 0) {
                            io.to(sessionId).emit('pause_countdown_tick', { countdown });
                        } else {
                            clearInterval(intervalId);
                        }
                    }, 1000);

                    setTimeout(async () => {
                        clearInterval(intervalId);
                        const checkGame = await GameSession.findById(sessionId);
                        if (checkGame && checkGame.gameStatus === 'PAUSED') {
                            try {
                                await resumeGame(sessionId, io);
                            } catch (e) {
                                console.error('Failed to auto-resume:', e);
                            }
                        }
                    }, 7000);
                } catch (e) {
                    console.error('Pause error during claim:', e);
                }

            } else {
                socket.emit('claim_result', { success: false, message: `Invalid ${prize.name} claim. Please verify your marked numbers.` });
            }
        } catch (err) {
            console.error(err);
            socket.emit('claim_result', { success: false, message: 'Server error processing claim' });
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
});

app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/game', require('./routes/gameRoutes'));
app.use('/api/player', require('./routes/playerRoutes'));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
