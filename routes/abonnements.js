const express = require('express');
const router = express.Router();
const abonnementsController = require('../controllers/abonnementsController');
const { authenticateToken, requireProprietaire, requireAdmin } = require('../middlewares/auth');

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

// Routes admin
router.patch('/:id/activer', requireAdmin, abonnementsController.activer);
router.patch('/:id/desactiver', requireAdmin, abonnementsController.desactiver);

/**
 * GET /abonnements/proprietaires
 * Rôle: admin
 * Retourne la liste des propriétaires avec leur statut d'abonnement (isActive)
 */
router.get('/proprietaires', requireAdmin, async (req, res) => {
  try {
    const proprietaires = await require('../models/User').find({ role: 'proprietaire' });
    const result = await Promise.all(proprietaires.map(async (p) => {
      let abonnement = null;
      if (p.abonnementId) {
        abonnement = await require('../models/Abonnement').findById(p.abonnementId);
      }
      return {
        _id: p._id,
        nom: p.nom,
        prenom: p.prenom,
        email: p.email,
        abonnement: abonnement ? { _id: abonnement._id, isActive: abonnement.isActive, statut: abonnement.statut } : null
      };
    }));
    res.json({ proprietaires: result });
  } catch (error) {
    console.error('Erreur liste propriétaires:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
