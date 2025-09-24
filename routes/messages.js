const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messagesController');
const { authenticateToken } = require('../middlewares/auth');

// Historique privé
router.get('/private/:otherUserId', authenticateToken, messagesController.getPrivateHistory);

// Historique de maison (groupe)
router.get('/house/:maisonId', authenticateToken, messagesController.getHouseHistory);

module.exports = router;


