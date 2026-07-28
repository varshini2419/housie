const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    let token = req.header('Authorization');
    
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        // Extract token robustly
        if (token.toLowerCase().startsWith('bearer ')) {
            token = token.substring(7).trim(); // Remove "Bearer " and spaces
        }
        
        // Remove any accidental quotes (e.g. from JSON.stringify in localStorage)
        token = token.replace(/^["']|["']$/g, '');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded.admin;
        next();
    } catch (err) {
        console.error('[Auth] Token verification failed:', err.message);
        res.status(401).json({ message: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
