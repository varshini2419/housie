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
        token = token.replace(/['"]/g, '');

        console.log(`[Backend Auth Debug] Extracted Token: ${token.substring(0, 15)}...`);
        console.log(`[Backend Auth Debug] JWT Secret Length: ${process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0}`);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(`[Backend Auth Debug] Token decoded successfully for admin ID: ${decoded.admin?.id}`);
        
        req.admin = decoded.admin;
        next();
    } catch (err) {
        console.error('[Auth] Token verification failed:', err.message);
        
        let preciseError = 'Token is not valid';
        if (err.name === 'TokenExpiredError') {
            preciseError = 'Token expired';
        } else if (err.name === 'JsonWebTokenError') {
            preciseError = 'Malformed JWT or Invalid signature';
            if (err.message.includes('signature')) {
                preciseError = 'Invalid signature';
            }
        }
        
        if (!process.env.JWT_SECRET) {
            console.error('[Auth] CRITICAL: JWT_SECRET environment variable is missing!');
            preciseError = 'JWT secret mismatch (server missing secret)';
        }

        res.status(401).json({ message: preciseError, debugInfo: err.message });
    }
};

module.exports = authMiddleware;
