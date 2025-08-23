const express = require('express');
const router = express.Router();
const residentsController = require('../controllers/residentsController');
const { authenticateToken, requireProprietaire } = require('../middlewares/auth');
const { checkSubscription, checkResidentQuota } = require('../middlewares/checkSubscription');

// Toutes les routes nécessitent une authentification et un rôle propriétaire
router.use(authenticateToken);
router.use(requireProprietaire);
router.use(checkSubscription);

// POST /residents - Ajouter un résident
router.post('/', checkResidentQuota, residentsController.addResident);

// GET /residents - Lister les résidents d'un propriétaire
router.get('/', residentsController.getResidents);

// GET /residents/:id - Obtenir un résident spécifique
router.get('/:id', residentsController.getResident);

// PUT /residents/:id - Mettre à jour un résident
router.put('/:id', residentsController.updateResident);

// DELETE /residents/:id - Supprimer un résident
router.delete('/:id', residentsController.deleteResident);

module.exports = router;
