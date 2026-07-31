const GameSession = require('../models/GameSession');
const DrawHistory = require('../models/DrawHistory');
const Ticket = require('../models/Ticket');
const Winner = require('../models/Winner');

const activeGames = {};
const VOICE_WAIT_SECONDS = 15;
const DRAW_COUNTDOWN_SECONDS = 5;

const fisherYatesShuffle = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex > 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

const generateNumber = async (game, io) => {
    const sId = game._id.toString();
    const state = activeGames[sId];
    if (!state) return false;

    if (state.availableNumbers.length === 0 || state.winners['Full House']) {
        await endGame(game._id, io);
        return false;
    }

    const nextNum = state.availableNumbers.pop();
    state.drawnNumbers.push(nextNum);

    console.log(`[SCHEDULER] Generated Number: ${nextNum}`);

    // Emit number_drawn immediately for instant socket delivery & countdown timer sync
    io.to(sId).emit('number_drawn', {
        number: nextNum,
        drawnNumbers: state.drawnNumbers,
        remainingNumbers: state.availableNumbers.length
    });

    // Save state to database asynchronously without blocking interval or socket timing
    GameSession.findByIdAndUpdate(game._id, {
        currentNumber: nextNum,
        drawnNumbers: state.drawnNumbers
    }).catch(err => console.error('Error updating GameSession:', err));

    if (state.drawnNumbers.length % 5 === 0) {
        DrawHistory.findOneAndUpdate(
            { sessionId: game._id },
            { numbersCalled: state.drawnNumbers },
            { upsert: true }
        ).catch(err => console.error('Error updating DrawHistory:', err));
    }

    const updatedGame = await GameSession.findById(game._id);

    const defaultPrizes = [
        { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, status: state.winners['Jaldi 5'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Jaldi 5']?.playerName || null, winnerTicket: state.winners['Jaldi 5']?.ticketCode || null, prizeItem: null },
        { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, status: state.winners['First Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['First Line']?.playerName || null, winnerTicket: state.winners['First Line']?.ticketCode || null, prizeItem: null },
        { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, status: state.winners['Second Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Second Line']?.playerName || null, winnerTicket: state.winners['Second Line']?.ticketCode || null, prizeItem: null },
        { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, status: state.winners['Third Line'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Third Line']?.playerName || null, winnerTicket: state.winners['Third Line']?.ticketCode || null, prizeItem: null },
        { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, status: state.winners['Full House'] ? 'COMPLETED' : 'AVAILABLE', winner: state.winners['Full House']?.playerName || null, winnerTicket: state.winners['Full House']?.ticketCode || null, prizeItem: null }
    ];

    const sessionPrizes = updatedGame && updatedGame.prizes && updatedGame.prizes.length > 0 ? updatedGame.prizes : defaultPrizes;

    Ticket.countDocuments({ sessionId: game._id }).then(totalJoined => {
        io.to(sId).emit('admin_stats', {
            totalJoined,
            onlineCount: state.onlinePlayers.size,
            remainingNumbers: state.availableNumbers.length,
            prizes: sessionPrizes
        });
    }).catch(err => console.error('Error in admin_stats:', err));

    // Hold countdown display at 5s while voice is speaking
    io.to(sId).emit('countdown_update', { countdown: 5 });

    state.phase = 'SPEECH_WAIT';
    state.tickCountdown = 6; // 6s max failsafe limit if client speech engine stalls

    return true;
};

const serverTick = async (sessionId, io) => {
    const sId = sessionId.toString();
    const state = activeGames[sId];
    if (!state) return;

    if (state.timerId) clearTimeout(state.timerId);

    // Authoritative check: If the game is paused or ended, halt the scheduler entirely.
    const game = await GameSession.findById(sId);
    if (!game || game.gameStatus !== 'LIVE') {
        console.log(`[SCHEDULER] Game is not LIVE (status: ${game?.gameStatus}). Halting serverTick.`);
        return;
    }

    if (state.phase === 'SPEECH_WAIT') {
        io.to(sId).emit('countdown_update', { countdown: 5 });
        state.tickCountdown--;
        if (state.tickCountdown <= 0) {
            state.phase = 'COUNTDOWN';
            state.tickCountdown = DRAW_COUNTDOWN_SECONDS;
            console.log(`[SCHEDULER] Voice Finished (Failsafe expired). Starting 5s Countdown.`);
            io.to(sId).emit('countdown_update', { countdown: state.tickCountdown });
        }
    } else if (state.phase === 'COUNTDOWN') {
        if (state.tickCountdown < 0) {
            console.log(`[SCHEDULER] Countdown reached 0. Generating Next Number...`);
            const continues = await generateNumber(game, io);
            if (!continues) return; // Game ended
        } else {
            io.to(sId).emit('countdown_update', { countdown: state.tickCountdown });
            console.log(`[SCHEDULER] Countdown: ${state.tickCountdown}`);
            state.tickCountdown--;
        }
    }

    state.timerId = setTimeout(() => serverTick(sessionId, io), 1000);
};

const pendingGameCreations = {};

const ensureActiveGame = async (sessionId, io) => {
    if (!sessionId) return null;
    const sIdStr = sessionId.toString();
    
    while (pendingGameCreations[sIdStr]) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (activeGames[sIdStr]) {
        if (io && !activeGames[sIdStr].timerLock && !activeGames[sIdStr].timerId) {
            activeGames[sIdStr].timerLock = true;
            try {
                const game = await GameSession.findById(sIdStr);
                if (game && game.gameStatus === 'LIVE' && !activeGames[sIdStr].timerId) {
                    console.log(`[SCHEDULER] Warning: Resuming tick on ensureActiveGame`);
                    activeGames[sIdStr].timerId = setTimeout(() => serverTick(sessionId, io), 1000);
                }
            } finally {
                activeGames[sIdStr].timerLock = false;
            }
        }
        return activeGames[sIdStr];
    }

    pendingGameCreations[sIdStr] = true;
    try {
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
            timerLock: false,
            phase: 'COUNTDOWN',
            tickCountdown: DRAW_COUNTDOWN_SECONDS,
            winners: winners,
            onlinePlayers: new Set()
        };

        if (game.gameStatus === 'LIVE' && io) {
            activeGames[sIdStr].timerId = setTimeout(() => serverTick(sessionId, io), 1000);
        }

        return activeGames[sIdStr];
    } finally {
        pendingGameCreations[sIdStr] = false;
    }
};

const triggerCountdown = (sessionId, io) => {
    if (!sessionId) return;
    const sIdStr = sessionId.toString();
    const state = activeGames[sIdStr];
    if (state && state.phase === 'SPEECH_WAIT') {
        state.phase = 'COUNTDOWN';
        state.tickCountdown = DRAW_COUNTDOWN_SECONDS; // 5
        console.log(`[SCHEDULER] Voice Finished. Starting 5s Countdown immediately.`);
        if (io) io.to(sIdStr).emit('countdown_update', { countdown: DRAW_COUNTDOWN_SECONDS });
    }
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
        clearTimeout(state.timerId);
    }

    console.log(`[SCHEDULER] Game Started. Timer Created.`);
    state.phase = 'COUNTDOWN';
    state.tickCountdown = DRAW_COUNTDOWN_SECONDS;
    state.timerId = setTimeout(() => serverTick(sessionId, io), 1000);
    
    io.to(sessionId.toString()).emit('game_started');
    return game;
};

const autoPauseTimers = {};

const triggerAutoPause = async (sessionId, io, durationSeconds = 10) => {
    if (!sessionId) return;
    const sIdStr = sessionId.toString();
    const game = await GameSession.findById(sessionId);
    if (!game || game.gameStatus !== 'LIVE') return;

    // Pause the game status in DB
    game.gameStatus = 'PAUSED';
    await game.save();

    const state = activeGames[sIdStr];
    if (state && state.timerId) {
        clearTimeout(state.timerId);
        state.timerId = null;
    }

    if (autoPauseTimers[sIdStr]) {
        clearInterval(autoPauseTimers[sIdStr]);
    }

    let remainingPause = durationSeconds;
    console.log(`[SCHEDULER] Auto-pausing game for ${durationSeconds}s due to valid prize claim.`);
    io.to(sIdStr).emit('game_paused', { status: 'PAUSED', countdown: remainingPause });

    autoPauseTimers[sIdStr] = setInterval(async () => {
        remainingPause--;
        if (remainingPause > 0) {
            io.to(sIdStr).emit('pause_countdown_tick', { countdown: remainingPause });
        } else {
            clearInterval(autoPauseTimers[sIdStr]);
            delete autoPauseTimers[sIdStr];

            // Auto Resume game after 10 seconds
            const g = await GameSession.findById(sessionId);
            if (g && g.gameStatus === 'PAUSED') {
                g.gameStatus = 'LIVE';
                await g.save();

                console.log(`[SCHEDULER] 10s auto-pause complete. Resuming game to LIVE.`);
                io.to(sIdStr).emit('game_resumed', { status: 'LIVE' });

                if (activeGames[sIdStr]) {
                    activeGames[sIdStr].phase = 'COUNTDOWN';
                    activeGames[sIdStr].tickCountdown = DRAW_COUNTDOWN_SECONDS;
                    activeGames[sIdStr].timerId = setTimeout(() => serverTick(sessionId, io), 1000);
                }
            }
        }
    }, 1000);
};

const pauseGame = async (sessionId, io) => {
    const game = await GameSession.findById(sessionId);
    if (!game || game.gameStatus !== 'LIVE') throw new Error('Game is not LIVE');

    game.gameStatus = 'PAUSED';
    await game.save();

    const state = await ensureActiveGame(sessionId, null);
    if (state && state.timerId) {
        console.log(`[SCHEDULER] Game Paused. Freezing Timer.`);
        clearTimeout(state.timerId);
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
            clearTimeout(state.timerId);
        }
        console.log(`[SCHEDULER] Game Resumed. Restarting Timer from phase: ${state.phase}, countdown: ${state.tickCountdown}`);
        state.timerId = setTimeout(() => serverTick(sessionId, io), 1000);
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
        clearTimeout(state.timerId);
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
            clearTimeout(activeGames[sIdStr].timerId);
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
    deleteGame,
    triggerCountdown,
    triggerAutoPause
};
