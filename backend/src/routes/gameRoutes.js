const express = require('express');
const router = express.Router();
const { 
    createSession, 
    getAllSessions,
    getSessionTickets,
    startGameSession,
    pauseGameSession,
    resumeGameSession,
    endGameSession
} = require('../controllers/gameController');
const auth = require('../middlewares/auth');

router.post('/create', auth, createSession);
router.get('/all', auth, getAllSessions);
router.get('/:id/tickets', auth, getSessionTickets);

router.post('/:id/start', auth, startGameSession);
router.post('/:id/pause', auth, pauseGameSession);
router.post('/:id/resume', auth, resumeGameSession);
router.post('/:id/end', auth, endGameSession);

module.exports = router;
