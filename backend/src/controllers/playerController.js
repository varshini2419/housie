const Ticket = require('../models/Ticket');
const GameSession = require('../models/GameSession');

exports.joinGame = async (req, res) => {
    const { ticketCode } = req.body;

    if (!ticketCode) {
        return res.status(400).json({ message: 'Ticket code is required' });
    }

    try {
        const ticket = await Ticket.findOne({ ticketCode }).populate('sessionId');

        if (!ticket) {
            return res.status(404).json({ message: 'Invalid ticket code' });
        }

        const session = ticket.sessionId;

        if (session.gameStatus === 'COMPLETED') {
            return res.status(400).json({ message: 'This game has already finished' });
        }

        if (ticket.playerStatus === 'WAITING') {
            ticket.playerStatus = 'PLAYING';
            await ticket.save();
        }

        res.json({
            message: 'Joined successfully',
            ticket: {
                ticketCode: ticket.ticketCode,
                ticketMatrix: ticket.ticketMatrix,
                markedNumbers: ticket.markedNumbers,
                status: ticket.playerStatus
            },
            session: {
                id: session._id,
                sessionName: session.sessionName,
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
