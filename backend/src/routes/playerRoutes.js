const express = require('express');
const router = express.Router();
const { joinGame } = require('../controllers/playerController');

router.post('/join', joinGame);

module.exports = router;
