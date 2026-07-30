const GameSession = require('../models/GameSession');
const DrawHistory = require('../models/DrawHistory');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');

const activeGames = {};

const fisherYatesShuffle = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex > 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

const drawIntervalLogic = async (game, io) => {
    const sId = game._id.toString();
    const state = activeGames[sId];
    if (!state) return;

    if (state.availableNumbers.length === 0 || state.winners['Full House']) {
        await endGame(game._id, io);
        return;
    }

    const nextNum = state.availableNumbers.pop();
    state.drawnNumbers.push(nextNum);

    if (state.drawnNumbers.length % 5 === 0) {
        await GameSession.findByIdAndUpdate(game._id, {
            currentNumber: nextNum,
            drawnNumbers: state.drawnNumbers
        });
        await DrawHistory.findOneAndUpdate(
            { sessionId: game._id },
            { numbersCalled: state.drawnNumbers },
            { upsert: true }
        );
    } else {
        await GameSession.findByIdAndUpdate(game._id, { currentNumber: nextNum });
    }

    io.to(sId).emit('number_drawn', {
        number: nextNum,
        drawnNumbers: state.drawnNumbers,
        remainingNumbers: state.availableNumbers.length
    });

    const updatedGame = await GameSession.findById(game._id);

    const defaultPrizes = [
        { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null },
        { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null },
        { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null },
        { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null },
        { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null }
    ];
    
    const sessionPrizes = updatedGame && updatedGame.prizes && updatedGame.prizes.length > 0 ? updatedGame.prizes : defaultPrizes;

    io.to(sId).emit('admin_stats', {
        totalJoined: await Ticket.countDocuments({ sessionId: game._id }),
        onlineCount: state.onlinePlayers.size,
        remainingNumbers: state.availableNumbers.length,
        prizes: sessionPrizes
    });
};

const ensureActiveGame = async (sessionId, io) => {
    if (!sessionId) return null;
    const sIdStr = sessionId.toString();
    
    if (activeGames[sIdStr]) {
        if (io) {
            const game = await GameSession.findById(sIdStr);
            if (game && game.gameStatus === 'LIVE' && !activeGames[sIdStr].timerId) {
                activeGames[sIdStr].timerId = setInterval(() => drawIntervalLogic(game, io), 5000);
            }
        }
        return activeGames[sIdStr];
    }

    const game = await GameSession.findById(sIdStr);
    if (!game) return null;

    const drawnNumbers = game.drawnNumbers || [];
    const allNums = Array.from({length: 90}, (_, i) => i + 1);
    const remainingNums = allNums.filter(n => !drawnNumbers.includes(n));
    const shuffled = fisherYatesShuffle(remainingNums);

    const winners = {};
    if (game.prizes && game.prizes.length > 0) {
        game.prizes.forEach(prize => {
            if (prize.status === 'COMPLETED') {
                winners[prize.name] = {
                    ticketCode: prize.winnerTicket,
                    playerName: prize.winner
                };
            }
        });
    }

    activeGames[sIdStr] = {
        availableNumbers: shuffled,
        drawnNumbers: drawnNumbers,
        timerId: null,
        winners: winners,
        onlinePlayers: new Set()
    };

    if (game.gameStatus === 'LIVE' && io) {
        activeGames[sIdStr].timerId = setInterval(() => drawIntervalLogic(game, io), 5000);
    }

    return activeGames[sIdStr];
};

const startGame = async (sessionId, io) => {
    const liveGame = await GameSession.findOne({ gameStatus: 'LIVE' });
    if (liveGame && liveGame._id.toString() !== sessionId.toString()) {
        throw new Error('Another session is already LIVE. Please end or pause it first.');
    }

    const game = await GameSession.findById(sessionId);
    if (!game) throw new Error('Session not found');

    if (game.gameStatus === 'COMPLETED') {
        throw new Error('Cannot start a completed game');
    }

    game.gameStatus = 'LIVE';
    await game.save();

    const state = await ensureActiveGame(sessionId, null);
    if (state.timerId) {
        clearInterval(state.timerId);
    }

    state.timerId = setInterval(() => drawIntervalLogic(game, io), 4000);
    io.to(sessionId.toString()).emit('game_started');
    return game;
};

const pauseGame = async (sessionId, io) => {
    const game = await GameSession.findById(sessionId);
    if (!game || game.gameStatus !== 'LIVE') throw new Error('Game is not LIVE');

    game.gameStatus = 'PAUSED';
    await game.save();

    const state = await ensureActiveGame(sessionId, null);
    if (state && state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }

    io.to(sessionId.toString()).emit('game_paused', { status: 'PAUSED' });
    return game;
};

const resumeGame = async (sessionId, io) => {
    const liveGame = await GameSession.findOne({ gameStatus: 'LIVE' });
    if (liveGame) throw new Error('Another session is already LIVE');

    const game = await GameSession.findById(sessionId);
    if (!game || game.gameStatus !== 'PAUSED') throw new Error('Game is not PAUSED');

    game.gameStatus = 'LIVE';
    await game.save();

    io.to(sessionId.toString()).emit('game_resumed', { status: 'LIVE' });

    const state = await ensureActiveGame(sessionId, null);
    if (state) {
        if (state.timerId) {
            clearInterval(state.timerId);
        }
        state.timerId = setInterval(() => drawIntervalLogic(game, io), 5000);
    }
    return game;
};

const endGame = async (sessionId, io) => {
    const game = await GameSession.findById(sessionId);
    if (!game) throw new Error('Game not found');

    game.gameStatus = 'COMPLETED';
    
    const state = await ensureActiveGame(sessionId, null);
    if (state) {
        game.currentNumber = state.drawnNumbers.slice(-1)[0] || null;
        game.drawnNumbers = state.drawnNumbers;
        
        await DrawHistory.findOneAndUpdate(
            { sessionId: game._id },
            { numbersCalled: state.drawnNumbers },
            { upsert: true }
        );
    }
    await game.save();

    if (state && state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }

    io.to(sessionId.toString()).emit('game_ended', { status: 'COMPLETED' });
    return game;
};

const deleteGame = async (sessionId, io) => {
    if (!sessionId) return;
    const sIdStr = sessionId.toString();
    
    if (activeGames[sIdStr]) {
        if (activeGames[sIdStr].timerId) {
            clearInterval(activeGames[sIdStr].timerId);
        }
        delete activeGames[sIdStr];
    }
    
    await GameSession.findByIdAndDelete(sIdStr);
    await Ticket.deleteMany({ sessionId: sIdStr });
    await DrawHistory.deleteMany({ sessionId: sIdStr });
    await Winner.deleteMany({ sessionId: sIdStr });
    
    if (io) {
        io.to(sIdStr).emit('game_deleted');
    }
};

module.exports = { 
    activeGames,
    ensureActiveGame,
    startGame,
    pauseGame,
    resumeGame,
    endGame,
    deleteGame
};
