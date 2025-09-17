const express = require('express');
const router = express.Router();
const consommationsController = require('../controllers/consommationsController');
const { authenticateToken } = require('../middlewares/auth');
const { checkSubscription } = require('../middlewares/checkSubscription');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Middleware de vérification d'abonnement pour les propriétaires seulement
router.use((req, res, next) => {
  // Si c'est une route résident, passer au suivant sans vérifier l'abonnement
  if (req.path.startsWith('/resident/') && req.user.role === 'resident') {
    return next();
  }
  // Sinon, vérifier l'abonnement
  return checkSubscription(req, res, next);
});

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
