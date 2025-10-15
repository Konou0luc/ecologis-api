const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');
const { authenticateToken } = require('../middlewares/auth');
const { uploadFileMiddleware } = require('../middlewares/upload');

// Créer un message
router.post('/', authenticateToken, messagesController.createMessage);

// Créer un message avec fichier
router.post('/file', authenticateToken, uploadFileMiddleware, messagesController.createFileMessage);

// Historique privé
router.get('/private/:otherUserId', authenticateToken, messagesController.getPrivateHistory);

// Historique de maison (groupe)
router.get('/house/:maisonId', authenticateToken, messagesController.getHouseHistory);

// Proxy de fichier Cloudinary
router.get('/file/proxy', messagesController.proxyFile);

module.exports = router;


