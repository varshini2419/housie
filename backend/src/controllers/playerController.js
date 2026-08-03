const Ticket = require('../models/Ticket');
const GameSession = require('../models/GameSession');
const Player = require('../models/Player');

exports.getAvailableSessions = async (req, res) => {
    try {
        const sessions = await GameSession.find({ 
            gameStatus: { $in: ['WAITING', 'LIVE', 'PAUSED'] } 
        }).select('sessionId sessionName startTime gameStatus totalPlayers').sort({ createdAt: -1 });
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching available sessions:', err);
        res.status(500).json({ message: 'Server error fetching sessions' });
    }
};

exports.register = async (req, res) => {
    const { fullName, email, mobile } = req.body;

    if (!fullName || !email || !mobile) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    try {
        const existingPlayer = await Player.findOne({ email });
        if (existingPlayer) {
            return res.status(400).json({ message: 'Email is already registered.' });
        }

        const player = new Player({ fullName, email, mobile });
        await player.save();

        res.status(201).json({ message: 'Registered successfully', player });
    } catch (err) {
        console.error('Error in registration:', err);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

exports.login = async (req, res) => {
    const { sessionId, mobile } = req.body;

    if (!sessionId || !mobile) {
        return res.status(400).json({ message: 'Please select a session and provide your mobile number.' });
    }

    try {
        // Find session by _id since the dropdown passes the _id
        const session = await GameSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found.' });
        }

        if (session.gameStatus === 'COMPLETED') {
            return res.status(400).json({ message: 'This session has already ended.' });
        }

        // Find player by mobile
        const player = await Player.findOne({ mobile });
        if (!player) {
            return res.status(404).json({ message: 'Player not found. Please register first.' });
        }

        // Check if player is already assigned a ticket for this session
        let ticket = await Ticket.findOne({ sessionId: session._id, playerId: player._id });

        // If not assigned, assign an available ticket
        if (!ticket) {
            ticket = await Ticket.findOne({ sessionId: session._id, playerId: null });
            if (!ticket) {
                return res.status(400).json({ message: 'No tickets available for this session.' });
            }
            
            // Assign the ticket and change its code to the player's mobile number
            ticket.playerId = player._id;
            ticket.playerName = player.fullName;
            ticket.ticketCode = player.mobile; // Replace random code with phone number
            ticket.playerStatus = 'PLAYING';
            ticket.joinedAt = new Date();
            await ticket.save();
        } else if (ticket.playerStatus === 'WAITING' || ticket.playerStatus === 'DISCONNECTED') {
            ticket.playerStatus = 'PLAYING';
            ticket.ticketCode = player.mobile; // Ensure ticket code is updated even if they rejoined
            await ticket.save();
        }

        const defaultPrizes = [
            { id: 'p1', name: 'Jaldi 5', type: 'Jaldi5', sequence: 1, status: 'AVAILABLE', winner: null, winnerTicket: null, prizeItem: null },
            { id: 'p2', name: 'First Line', type: 'FirstLine', sequence: 1, status: 'AVAILABLE', winner: null, winnerTicket: null, prizeItem: null },
            { id: 'p3', name: 'Second Line', type: 'SecondLine', sequence: 1, status: 'AVAILABLE', winner: null, winnerTicket: null, prizeItem: null },
            { id: 'p4', name: 'Third Line', type: 'ThirdLine', sequence: 1, status: 'AVAILABLE', winner: null, winnerTicket: null, prizeItem: null },
            { id: 'p5', name: 'Full House', type: 'FullHouse', sequence: 1, status: 'AVAILABLE', winner: null, winnerTicket: null, prizeItem: null }
        ];

        const sessionPrizes = session.prizes && session.prizes.length > 0 ? session.prizes : defaultPrizes;

        res.json({
            success: true,
            message: 'Login successful',
            player: {
                name: player.fullName,
                email: player.email
            },
            ticket: {
                ticketCode: ticket.ticketCode,
                playerName: ticket.playerName,
                ticketMatrix: ticket.ticketMatrix,
                markedNumbers: ticket.markedNumbers,
                status: ticket.playerStatus
            },
            session: {
                id: session._id,
                sessionId: session.sessionId,
                sessionName: session.sessionName,
                totalPlayers: session.totalPlayers,
                startTime: session.startTime,
                gameStatus: session.gameStatus,
                currentNumber: session.currentNumber,
                drawnNumbers: session.drawnNumbers,
                prizes: sessionPrizes.map(p => ({
                    id: p.id,
                    name: p.name,
                    status: p.status,
                    winner: p.winner,
                    winnerTicket: p.winnerTicket,
                    prizeItem: p.prizeItem || null
                }))
            }
        });

    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).json({ message: 'Server error during login' });
    }
};
