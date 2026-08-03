const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    mobile: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Player', PlayerSchema);
