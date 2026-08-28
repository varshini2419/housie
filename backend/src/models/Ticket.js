const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null, index: true },
    ticketCode: { type: String, required: true, index: true },
    ticketMatrix: { type: [[Number]], required: true },
    markedNumbers: { type: [Number], default: [] },
    playerStatus: { type: String, enum: ['WAITING', 'PLAYING', 'DISCONNECTED'], default: 'WAITING' },
    playerName: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    requestStatus: { type: String, enum: ['NONE', 'PENDING', 'ACCEPTED', 'DECLINED'], default: 'NONE' },
    joinedAt: { type: Date }
}, { timestamps: true });

// Ensure unique ticket codes within a session
TicketSchema.index({ sessionId: 1, ticketCode: 1 }, { unique: true });

module.exports = mongoose.model('Ticket', TicketSchema);
