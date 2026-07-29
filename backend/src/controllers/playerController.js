const Ticket = require('../models/Ticket');
const GameSession = require('../models/GameSession');

exports.getAvailableSessions = async (req, res) => {
    try {
        const sessions = await GameSession.find({ 
            gameStatus: { $in: ['WAITING', 'LIVE', 'PAUSED'] } 
        }).select('_id sessionName startTime gameStatus totalPlayers').sort({ createdAt: -1 });
        res.json(sessions);
    } catch (err) {
        console.error('Error fetching available sessions:', err);
        res.status(500).json({ message: 'Server error fetching sessions' });
    }
};

exports.joinGame = async (req, res) => {
    const { sessionId, ticketCode } = req.body;

    if (!sessionId) {
        return res.status(400).json({ message: 'Please select a session.' });
    }
    if (!ticketCode) {
        return res.status(400).json({ message: 'Please enter your Ticket Code.' });
    }

    try {
        const session = await GameSession.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Selected session not found.' });
        }

        if (session.gameStatus === 'COMPLETED') {
            return res.status(400).json({ message: 'This session has already ended.' });
        }

        const ticket = await Ticket.findOne({ sessionId, ticketCode });

        if (!ticket) {
            return res.status(404).json({ message: 'Invalid Ticket Code for the selected session.' });
        }

        if (ticket.playerStatus === 'WAITING') {
            ticket.playerStatus = 'PLAYING';
            ticket.joinedAt = new Date();
            await ticket.save();
        }

        res.json({
            message: 'Joined successfully',
            ticket: {
                ticketCode: ticket.ticketCode,
                playerName: ticket.playerName,
                ticketMatrix: ticket.ticketMatrix,
                markedNumbers: ticket.markedNumbers,
                status: ticket.playerStatus
            },
            session: {
                id: session._id,
                sessionName: session.sessionName,
                totalPlayers: session.totalPlayers,
                startTime: session.startTime,
                gameStatus: session.gameStatus,
                currentNumber: session.currentNumber,
                drawnNumbers: session.drawnNumbers
            }
        });

    } catch (err) {
        console.error('Error joining game:', err);
        res.status(500).json({ message: 'Server error joining game' });
    }
};
