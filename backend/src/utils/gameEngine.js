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

    const updatedGame = await GameSession.findById(game._id);

    const defaultPrizes = [
        { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null },
        { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null },
        { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null },
        { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null },
        { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null }
    ];
    
    const sessionPrizes = updatedGame && updatedGame.prizes && updatedGame.prizes.length > 0 ? updatedGame.prizes : defaultPrizes;

    io.to(game._id.toString()).emit('admin_stats', {
        totalJoined: await Ticket.countDocuments({ sessionId: game._id }),
        onlineCount: state.onlinePlayers.size,
        remainingNumbers: state.availableNumbers.length,
        prizes: sessionPrizes
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
