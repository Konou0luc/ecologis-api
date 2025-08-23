const express = require('express');
const router = express.Router();
const abonnementsController = require('../controllers/abonnementsController');
const { authenticateToken, requireProprietaire } = require('../middlewares/auth');

// GET /abonnements - Liste des offres (public)
router.get('/', abonnementsController.getOffres);

// Routes nécessitant une authentification et un rôle propriétaire
router.use(authenticateToken);
router.use(requireProprietaire);

// POST /abonnements/souscrire - Souscrire à un abonnement
router.post('/souscrire', abonnementsController.souscrire);

// POST /abonnements/renouveler - Renouveler un abonnement
router.post('/renouveler', abonnementsController.renouveler);

// GET /abonnements/actuel - Obtenir l'abonnement actuel
router.get('/actuel', abonnementsController.getAbonnementActuel);

// POST /abonnements/annuler - Annuler un abonnement
router.post('/annuler', abonnementsController.annuler);

// GET /abonnements/historique - Historique des abonnements
router.get('/historique', abonnementsController.getHistorique);

module.exports = router;
