const GameSession = require('../models/GameSession');
const DrawHistory = require('../models/DrawHistory');
const Ticket = require('../models/Ticket');

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
    const state = activeGames[game._id];
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

    io.to(game._id.toString()).emit('number_drawn', {
        number: nextNum,
        history: state.drawnNumbers
    });

    io.to(game._id.toString()).emit('admin_stats', {
        totalJoined: await Ticket.countDocuments({ sessionId: game._id }),
        onlineCount: state.onlinePlayers.size,
        remainingNumbers: state.availableNumbers.length,
        winners: state.winners
    });
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

    if (!activeGames[sessionId]) {
        const nums = Array.from({length: 90}, (_, i) => i + 1);
        const shuffled = fisherYatesShuffle(nums);

        activeGames[sessionId] = {
            availableNumbers: shuffled,
            drawnNumbers: [],
            timerId: null,
            winners: {},
            onlinePlayers: new Set()
        };
    }

    io.to(sessionId.toString()).emit('game_started', {
        sessionId: sessionId,
        status: 'LIVE'
    });

    if (activeGames[sessionId].timerId) {
        clearInterval(activeGames[sessionId].timerId);
    }

    activeGames[sessionId].timerId = setInterval(() => drawIntervalLogic(game, io), 5000);
    return game;
};

const pauseGame = async (sessionId, io) => {
    const game = await GameSession.findById(sessionId);
    if (!game || game.gameStatus !== 'LIVE') throw new Error('Game is not LIVE');

    game.gameStatus = 'PAUSED';
    await game.save();

    if (activeGames[sessionId] && activeGames[sessionId].timerId) {
        clearInterval(activeGames[sessionId].timerId);
        activeGames[sessionId].timerId = null;
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

    if (activeGames[sessionId]) {
        activeGames[sessionId].timerId = setInterval(() => drawIntervalLogic(game, io), 5000);
    }
    return game;
};

const endGame = async (sessionId, io) => {
    const game = await GameSession.findById(sessionId);
    if (!game) throw new Error('Game not found');

    game.gameStatus = 'COMPLETED';
    
    if (activeGames[sessionId]) {
        game.currentNumber = activeGames[sessionId].drawnNumbers.slice(-1)[0] || null;
        game.drawnNumbers = activeGames[sessionId].drawnNumbers;
        
        await DrawHistory.findOneAndUpdate(
            { sessionId: game._id },
            { numbersCalled: activeGames[sessionId].drawnNumbers },
            { upsert: true }
        );
    }
    await game.save();

    if (activeGames[sessionId] && activeGames[sessionId].timerId) {
        clearInterval(activeGames[sessionId].timerId);
        activeGames[sessionId].timerId = null;
    }

    io.to(sessionId.toString()).emit('game_ended', { status: 'COMPLETED' });
    return game;
};

module.exports = { 
    activeGames,
    startGame,
    pauseGame,
    resumeGame,
    endGame
};
