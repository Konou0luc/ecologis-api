const express = require('express');
const router = express.Router();
const facturesController = require('../controllers/facturesController');
const { authenticateToken } = require('../middlewares/auth');
const { checkSubscription } = require('../middlewares/checkSubscription');

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// Middleware de vérification d'abonnement pour les propriétaires seulement
router.use((req, res, next) => {
  // Si c'est une route résident (my-factures, my-maison-factures) ou si l'utilisateur est un résident, passer au suivant sans vérifier l'abonnement
  if ((req.path.startsWith('/my-') || req.path.startsWith('/resident/')) && req.user.role === 'resident') {
    return next();
  }
  // Sinon, vérifier l'abonnement
  return checkSubscription(req, res, next);
});

// POST /factures/generer/:residentId - Générer une facture pour un résident
router.post('/generer/:residentId', facturesController.generateFacture);

// GET /factures/resident/:residentId - Factures d'un résident
router.get('/resident/:residentId', facturesController.getFacturesByResident);

// GET /factures/maison/:maisonId - Factures d'une maison
router.get('/maison/:maisonId', facturesController.getFacturesByMaison);

// ===== ROUTES SPÉCIFIQUES POUR LES RÉSIDENTS =====
// Ces routes permettent aux résidents de récupérer leurs propres données sans passer par l'ID dans l'URL
// IMPORTANT: Ces routes doivent être définies AVANT /:id pour éviter les conflits

// GET /factures/my-factures - Factures du résident connecté
router.get('/my-factures', facturesController.getMyFactures);

// GET /factures/my-maison-factures - Factures de la maison du résident connecté
router.get('/my-maison-factures', facturesController.getMyMaisonFactures);

// GET /factures/:id - Obtenir une facture spécifique
router.get('/:id', facturesController.getFacture);

// PUT /factures/:id/payer - Marquer une facture comme payée
router.put('/:id/payer', facturesController.markFactureAsPaid);

module.exports = router;
