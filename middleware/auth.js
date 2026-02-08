const jwt = require('jsonwebtoken');
const { getDb } = require('../config/firebase');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Check if user still exists and is active
        const db = getDb();
        const userDoc = await db.collection('users').doc(decoded.phone).get();

        if (!userDoc.exists || userDoc.data().isActive !== true) {
            return res.status(401).json({ error: 'Invalid token or user not found' });
        }
        req.user = userDoc.data();
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};



const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const db = getDb();
        const userDoc = await db.collection('users').doc(decoded.phone).get();

        if (userDoc.exists && userDoc.data().isActive === true) {
            req.user = userDoc.data();
        } else {
            req.user = null;
        }
    } catch (error) {
        req.user = null;
    }

    next();
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

module.exports = { authenticateToken, optionalAuth, requireRole };