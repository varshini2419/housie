const mongoose = require('mongoose');

const DrawHistorySchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameSession', required: true, index: true, unique: true },
    numbersCalled: { type: [Number], default: [] },
    completed: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('DrawHistory', DrawHistorySchema);
