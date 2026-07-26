const GameSession = require('../models/GameSession');
const Ticket = require('../models/Ticket');
const { generateBatch } = require('../utils/ticketGenerator');
const { startGame, pauseGame, resumeGame, endGame } = require('../utils/gameEngine');

exports.createSession = async (req, res) => {
    const { sessionName, startTime, totalPlayers } = req.body;

    if (!sessionName || !startTime || !totalPlayers) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const newSession = new GameSession({
            sessionName,
            startTime,
            totalPlayers,
            gameStatus: 'WAITING'
        });

        const savedSession = await newSession.save();

        const generatedTickets = generateBatch(totalPlayers);
        
        const ticketDocs = generatedTickets.map(t => ({
            sessionId: savedSession._id,
            ticketCode: t.ticketCode,
            ticketMatrix: t.ticketMatrix,
            playerStatus: 'WAITING'
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
            .select('ticketCode playerStatus playerName createdAt')
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
