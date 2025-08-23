const express = require('express');
const router = express.Router();
const consommationsController = require('../controllers/consommationsController');
const { authenticateToken } = require('../middlewares/auth');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// POST /consommations - Enregistrer une consommation
router.post('/', consommationsController.addConsommation);

// GET /consommations/resident/:residentId - Historique des consommations d'un résident
router.get('/resident/:residentId', consommationsController.getConsommationsByResident);

// GET /consommations/maison/:maisonId - Consommations d'une maison
router.get('/maison/:maisonId', consommationsController.getConsommationsByMaison);

// PUT /consommations/:id - Mettre à jour une consommation
router.put('/:id', consommationsController.updateConsommation);

// DELETE /consommations/:id - Supprimer une consommation
router.delete('/:id', consommationsController.deleteConsommation);

module.exports = router;
