const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    ticketCode: { type: String, required: true, index: true },
    ticketMatrix: { type: [[Number]], required: true },
    markedNumbers: { type: [Number], default: [] },
    playerStatus: { type: String, enum: ['WAITING', 'PLAYING', 'DISCONNECTED'], default: 'WAITING' }
}, { timestamps: true });

// Ensure unique ticket codes within a session
TicketSchema.index({ sessionId: 1, ticketCode: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', TicketSchema);
