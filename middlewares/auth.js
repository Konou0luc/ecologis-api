const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware pour vérifier le token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ message: 'Token d\'accès requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Récupérer l'utilisateur depuis la base de données
    const user = await User.findById(decoded.userId).select('-motDePasse -refreshToken');
    
    if (!user) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expiré' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token invalide' });
    }
    return res.status(500).json({ message: 'Erreur d\'authentification' });
  }
};

// Middleware pour vérifier le rôle propriétaire
const requireProprietaire = (req, res, next) => {
  if (req.user.role !== 'proprietaire') {
    return res.status(403).json({ message: 'Accès réservé aux propriétaires' });
  }
  next();
};

// Middleware pour vérifier le rôle résident
const requireResident = (req, res, next) => {
  if (req.user.role !== 'resident') {
    return res.status(403).json({ message: 'Accès réservé aux résidents' });
  }
  next();
};

// Middleware pour vérifier le rôle admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
  }
  next();
};

// Middleware pour vérifier si c'est le premier login
const requirePasswordChange = (req, res, next) => {
  if (req.user.firstLogin) {
    return res.status(403).json({ 
      message: 'Changement de mot de passe requis',
      firstLogin: true 
    });
  }
  next();
};

// Middleware pour vérifier le refresh token
const authenticateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token requis' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await User.findById(decoded.userId);
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Refresh token invalide' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Refresh token invalide' });
  }
};

module.exports = {
  authenticateToken,
  requireProprietaire,
  requireResident,
  requirePasswordChange,
  authenticateRefreshToken
};
