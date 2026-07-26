const express = require('express');
const router = express.Router();
const { login, setupAdmin } = require('../controllers/adminController');
const auth = require('../middlewares/auth');

// @route   POST /api/admin/setup
// @desc    Initialize a default admin (run once)
router.post('/setup', setupAdmin);

// @route   POST /api/admin/login
// @desc    Authenticate admin & get token
router.post('/login', login);

// @route   GET /api/admin/me
// @desc    Get current admin info
router.get('/me', auth, (req, res) => {
    res.json({ message: 'Authenticated', admin: req.admin });
});

module.exports = router;
