const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requirePasswordChange } = require('../middlewares/auth');

// POST /auth/register - Créer un compte propriétaire
router.post('/register', authController.register);

// POST /auth/login - Connexion
router.post('/login', authController.login);

// POST /auth/refresh - Rafraîchir le token
router.post('/refresh', authController.refreshToken);

// POST /auth/logout - Déconnexion
router.post('/logout', authenticateToken, authController.logout);

// POST /auth/reset-password - Changement de mot de passe (premier login)
router.post('/reset-password', authenticateToken, requirePasswordChange, authController.resetPassword);

// POST /auth/change-password - Changement de mot de passe normal
router.post('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
