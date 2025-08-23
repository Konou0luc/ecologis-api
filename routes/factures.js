const express = require('express');
const router = express.Router();
const facturesController = require('../controllers/facturesController');
const { authenticateToken } = require('../middlewares/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// POST /factures/generer/:residentId - Générer une facture pour un résident
router.post('/generer/:residentId', facturesController.generateFacture);

// GET /factures/resident/:residentId - Factures d'un résident
router.get('/resident/:residentId', facturesController.getFacturesByResident);

// GET /factures/maison/:maisonId - Factures d'une maison
router.get('/maison/:maisonId', facturesController.getFacturesByMaison);

// GET /factures/:id - Obtenir une facture spécifique
router.get('/:id', facturesController.getFacture);

// PUT /factures/:id/payer - Marquer une facture comme payée
router.put('/:id/payer', facturesController.markFactureAsPaid);

module.exports = router;
