const express = require('express');
const router = express.Router();
const { 
    createSession, 
    getAllSessions,
    getSessionTickets,
    startGameSession,
    pauseGameSession,
    resumeGameSession,
    endGameSession,
    assignPlayerName,
    toggleTicketActive,
    handleTicketRequest,
    acceptAllPendingRequests,
    deleteGameSession
} = require('../controllers/gameController');
const auth = require('../middlewares/auth');

router.post('/create', auth, createSession);
router.get('/all', auth, getAllSessions);
router.get('/:id/tickets', auth, getSessionTickets);
router.put('/:id/tickets/accept-all', auth, acceptAllPendingRequests);
router.put('/:id/tickets/:ticketCode/name', auth, assignPlayerName);
router.put('/:id/tickets/:ticketCode/active', auth, toggleTicketActive);
router.put('/:id/tickets/:ticketCode/request', auth, handleTicketRequest);

router.post('/:id/start', auth, startGameSession);
router.post('/:id/pause', auth, pauseGameSession);
router.post('/:id/resume', auth, resumeGameSession);
router.post('/:id/end', auth, endGameSession);
router.delete('/:id', auth, deleteGameSession);

module.exports = router;
