const admin = require('../config/firebaseAdmin');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Attaches the secure user ID to the request
    next(); // Lets the request pass through to the database
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(403).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

module.exports = verifyToken;