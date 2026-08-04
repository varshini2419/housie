const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');

router.get('/sessions', playerController.getAvailableSessions);
router.post('/register', playerController.register);
router.post('/login', playerController.login);

module.exports = router;
