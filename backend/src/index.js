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

connectDB();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
app.set('io', io);

const { activeGames, pauseGame, resumeGame } = require('./utils/gameEngine');

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    socket.on('join_game', async ({ sessionId, ticketCode, role }) => {
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
            const status = game ? game.gameStatus : 'WAITING';
            
            let markedNums = [];
            if (role === 'player' && ticketCode) {
                const t = await Ticket.findOne({ ticketCode, sessionId });
                if (t) markedNums = t.markedNumbers;
            }

            socket.emit('game_sync', {
                status: status,
                currentNumber: activeGames[sessionId].drawnNumbers.slice(-1)[0] || null,
                drawnNumbers: activeGames[sessionId].drawnNumbers,
                winners: activeGames[sessionId].winners,
                markedNumbers: markedNums
            });
        }
    });

    socket.on('mark_number', async ({ sessionId, ticketCode, number }) => {
        const state = activeGames[sessionId];
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

    socket.on('claim_prize', async ({ sessionId, ticketCode, prizeType }) => {
        const state = activeGames[sessionId];
        if (!state) return socket.emit('claim_rejected', { message: 'Game not active' });

        const game = await GameSession.findById(sessionId);
        if (!game || game.gameStatus !== 'LIVE') {
            return socket.emit('claim_rejected', { message: 'Game is not LIVE' });
        }

        if (state.winners[prizeType]) {
            return socket.emit('claim_rejected', { message: 'Prize already claimed' });
        }

        try {
            const ticket = await Ticket.findOne({ ticketCode, sessionId });
            if (!ticket) return socket.emit('claim_rejected', { message: 'Ticket not found' });

            const isValid = validateClaim(prizeType, ticket.ticketMatrix, state.drawnNumbers, ticket.markedNumbers);

            if (isValid) {
                if (state.winners[prizeType]) return socket.emit('claim_rejected', { message: 'Prize already claimed' });
                
                state.winners[prizeType] = ticketCode;

                const newWinner = new Winner({ sessionId, prizeType, ticketCode });
                await newWinner.save();
                
                // Live Activity Feed for Admin
                io.to(sessionId).emit('activity_feed', {
                    message: `Player (Ticket ${ticketCode}) won ${prizeType}.`,
                    ticketCode,
                    prizeType
                });

                io.to(sessionId).emit('winner_announced', {
                    prizeType,
                    ticketCode,
                    winners: state.winners
                });

                // 2-Second Pause Logic
                try {
                    await pauseGame(sessionId, io);
                    setTimeout(async () => {
                        const checkGame = await GameSession.findById(sessionId);
                        if (checkGame && checkGame.gameStatus === 'PAUSED') {
                            try {
                                await resumeGame(sessionId, io);
                            } catch (e) {
                                console.error('Failed to auto-resume:', e);
                            }
                        }
                    }, 2000);
                } catch (e) {
                    console.error('Pause error during claim:', e);
                }

            } else {
                socket.emit('claim_rejected', { message: 'Invalid claim' });
            }
        } catch (err) {
            console.error(err);
            socket.emit('claim_rejected', { message: 'Server error processing claim' });
        }
    });

    socket.on('disconnect', () => {
        if (socket.sessionId && activeGames[socket.sessionId] && socket.ticketCode) {
            activeGames[socket.sessionId].onlinePlayers.delete(socket.ticketCode);
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
