const mongoose = require('mongoose');

const WinnerSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true },
    prizeType: { type: String, required: true, enum: ['Jaldi 5', 'First Line', 'Second Line', 'Third Line', 'Full House'] },
    ticketCode: { type: String, required: true },
    claimedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// A prize can only be won once per session
WinnerSchema.index({ sessionId: 1, prizeType: 1 }, { unique: true });

module.exports = mongoose.model('Winner', WinnerSchema);
