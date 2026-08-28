const GameSession = require('../models/GameSession');
const Ticket = require('../models/Ticket');
const { generateBatch } = require('../utils/ticketGenerator');
const { startGame, pauseGame, resumeGame, endGame, deleteGame } = require('../utils/gameEngine');

exports.createSession = async (req, res) => {
    const { sessionName, startTime, totalPlayers, ticketCodeMode, startingRegisterNumber, prizes, logos } = req.body;

    if (!sessionName || !startTime || !totalPlayers) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    if (ticketCodeMode === 'PATTERN') {
        if (!startingRegisterNumber) {
            return res.status(400).json({ message: 'Starting Ticket Code is required' });
        }
        if (!/.*?\d+$/.test(startingRegisterNumber)) {
            return res.status(400).json({ message: 'Starting Ticket Code must end with a numeric sequence' });
        }
    }

    const defaultPrizes = [
        { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, enabled: true },
        { id: 'p2', name: 'Four Corners', type: 'FourCorners', sequence: 1, enabled: true },
        { id: 'p3', name: 'Six Corners', type: 'SixCorners', sequence: 1, enabled: true },
        { id: 'p4', name: 'Middle Number', type: 'MiddleNumber', sequence: 1, enabled: true },
        { id: 'p5', name: 'First Line', type: 'FirstLine', sequence: 1, enabled: true },
        { id: 'p6', name: 'Second Line', type: 'SecondLine', sequence: 1, enabled: true },
        { id: 'p7', name: 'Third Line', type: 'ThirdLine', sequence: 1, enabled: true },
        { id: 'p8', name: 'Full House', type: 'FullHouse', sequence: 1, enabled: true }
    ];

    const sessionPrizes = prizes && prizes.length > 0 ? prizes : defaultPrizes;

    const initializedPrizes = sessionPrizes.map(p => ({
        ...p,
        status: p.sequence === 1 ? 'AVAILABLE' : 'LOCKED',
        winner: null,
        winnerTicket: null,
        claimedAt: null, 
        prizeItem: p.prizeItem || null 
    }));

    const generatedSessionId = req.body.sessionId || Math.random().toString(36).substring(2, 8).toUpperCase();
    const generatedPassword = req.body.password || Math.floor(1000 + Math.random() * 9000).toString();

    const sessionLogos = Array.isArray(logos) && logos.length === 3 ? logos : ['', '', ''];

    try {
        const newSession = new GameSession({
            sessionId: generatedSessionId,
            password: generatedPassword,
            sessionName,
            startTime,
            totalPlayers,
            gameStatus: 'WAITING',
            prizes: initializedPrizes,
            logos: sessionLogos
        });

        const savedSession = await newSession.save();

        const generatedTickets = generateBatch(totalPlayers, { ticketCodeMode, startingRegisterNumber });
        
        const ticketDocs = generatedTickets.map(t => ({
            sessionId: savedSession._id,
            ticketCode: t.ticketCode,
            ticketMatrix: t.ticketMatrix,
            playerStatus: 'WAITING',
            isActive: false
        }));

        await Ticket.insertMany(ticketDocs);

        res.status(201).json({ 
            message: 'Game session and tickets created successfully',
            session: savedSession,
            ticketsGenerated: totalPlayers
        });

    } catch (err) {
        console.error('Error creating session:', err);
        res.status(500).json({ message: 'Server error creating session' });
    }
};

exports.getAllSessions = async (req, res) => {
    try {
        const sessions = await GameSession.find().sort({ createdAt: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching sessions' });
    }
};

exports.getSessionTickets = async (req, res) => {
    try {
        const tickets = await Ticket.find({ sessionId: req.params.id })
            .select('ticketCode playerStatus playerName isActive createdAt')
            .sort({ createdAt: 1 });
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ message: 'Server error fetching tickets' });
    }
};

exports.assignPlayerName = async (req, res) => {
    const { id, ticketCode } = req.params;
    const { playerName } = req.body;

    try {
        const ticket = await Ticket.findOne({ sessionId: id, ticketCode });
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        ticket.playerName = playerName;
        await ticket.save();

        res.json({ message: 'Player name assigned', ticket });
    } catch (err) {
        console.error('Error assigning player name:', err);
        res.status(500).json({ message: 'Server error assigning name' });
    }
};

exports.toggleTicketActive = async (req, res) => {
    const { id, ticketCode } = req.params;
    const { isActive } = req.body;

    try {
        const ticket = await Ticket.findOne({ sessionId: id, ticketCode });
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        ticket.isActive = typeof isActive === 'boolean' ? isActive : !ticket.isActive;
        await ticket.save();

        res.json({ message: 'Ticket active status updated', ticket });
    } catch (err) {
        console.error('Error updating ticket active status:', err);
        res.status(500).json({ message: 'Server error updating ticket active status' });
    }
};

// Admin Action Controllers
exports.startGameSession = async (req, res) => {
    try {
        const io = req.app.get('io');
        const game = await startGame(req.params.id, io);
        res.json({ message: 'Game started successfully', game });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.pauseGameSession = async (req, res) => {
    try {
        const io = req.app.get('io');
        const game = await pauseGame(req.params.id, io);
        res.json({ message: 'Game paused successfully', game });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.resumeGameSession = async (req, res) => {
    try {
        const io = req.app.get('io');
        const game = await resumeGame(req.params.id, io);
        res.json({ message: 'Game resumed successfully', game });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.endGameSession = async (req, res) => {
    try {
        const io = req.app.get('io');
        const game = await endGame(req.params.id, io);
        res.json({ message: 'Game ended successfully', game });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
};

exports.deleteGameSession = async (req, res) => {
    try {
        const io = req.app.get('io');
        await deleteGame(req.params.id, io);
        res.json({ message: 'Game session deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Server error deleting session' });
    }
};
