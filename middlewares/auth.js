const jwt = require('jsonwebtoken');
const User = require('../models/userModel'); // Ensure you have a User model

const authMiddleware = async (req, res, next) => {
    try {
        // Check if token exists (either in session or Authorization header)
        const token = req.session?.token || req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: 'Access Denied. No Token Provided.' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

        // Fetch user details
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found.' });
        }

        req.user = user; // Attach user to request object
        next(); // Continue to next middleware
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(403).json({ message: 'Invalid Token.' });
    }
};

module.exports = { authMiddleware };
