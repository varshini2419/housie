const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema({
    sessionName: { type: String, required: true },
    startTime: { type: Date, required: true },
    totalPlayers: { type: Number, required: true },
    gameStatus: { type: String, enum: ['WAITING', 'LIVE', 'PAUSED', 'COMPLETED'], default: 'WAITING', index: true },
    currentNumber: { type: Number, default: null },
    drawnNumbers: { type: [Number], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('GameSession', GameSessionSchema);
