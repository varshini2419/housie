const mongoose = require('mongoose');

const PrizeSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    sequence: { type: Number, required: true },
    winner: { type: String, default: null }, // Store Player Name
    winnerTicket: { type: String, default: null },
    prizeItem: { type: String, default: null },
    sponsor: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    status: { type: String, enum: ['LOCKED', 'AVAILABLE', 'COMPLETED'], default: 'AVAILABLE' }
}, { _id: false });

const GameSessionSchema = new mongoose.Schema({
    sessionId: { type: String, unique: true, sparse: true },
    password: { type: String },
    sessionName: { type: String, required: true },
    startTime: { type: Date, required: true },
    totalPlayers: { type: Number, required: true },
    gameStatus: { type: String, enum: ['WAITING', 'LIVE', 'PAUSED', 'COMPLETED'], default: 'WAITING', index: true },
    currentNumber: { type: Number, default: null },
    drawnNumbers: { type: [Number], default: [] },
    prizes: { type: [PrizeSchema], default: [] },
    pauseState: { 
        countdown: { type: Number },
        currentWinner: { type: Object }
    },
    stateVersion: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('GameSession', GameSessionSchema);
