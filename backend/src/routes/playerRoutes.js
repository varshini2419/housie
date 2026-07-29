const express = require('express');
const router = express.Router();
const { joinGame, getAvailableSessions } = require('../controllers/playerController');

router.get('/sessions', getAvailableSessions);
router.post('/join', joinGame);

module.exports = router;
