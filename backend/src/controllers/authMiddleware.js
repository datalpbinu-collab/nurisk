const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'PUSDATIN_JATENG_SECRET_2024';

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token format' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token is empty' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('[AUTH] Decoded token for', req.path, ':', JSON.stringify(decoded));
        
        // Ensure decoded has required fields
        if (!decoded.id || !decoded.role) {
            console.error('[AUTH] Token missing id or role:', decoded);
            return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

module.exports = authMiddleware;