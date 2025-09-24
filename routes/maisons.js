const express = require('express');
const router = express.Router();
const maisonsController = require('../controllers/maisonsController');
const { authenticateToken } = require('../middlewares/auth');
// Get maison détaillée avec residents (chemin distinct pour éviter conflit)
router.get('/:id/full', authenticateToken, maisonsController.getMaisonById);

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

// POST /maisons - Créer une maison
router.post('/', maisonsController.createMaison);

// GET /maisons - Lister les maisons
router.get('/', maisonsController.getMaisons);

// GET /maisons/:id - Obtenir une maison spécifique
router.get('/:id', maisonsController.getMaison);

// PUT /maisons/:id - Mettre à jour une maison
router.put('/:id', maisonsController.updateMaison);

// DELETE /maisons/:id - Supprimer une maison
router.delete('/:id', maisonsController.deleteMaison);

// PATCH /maisons/:id/tarif - Mettre à jour le tarif de la maison
router.patch('/:id/tarif', maisonsController.updateMaisonTarif);

// POST /maisons/residents/ajouter - Ajouter un résident à une maison
router.post('/residents/ajouter', maisonsController.addResidentToMaison);

// POST /maisons/residents/retirer - Retirer un résident d'une maison
router.post('/residents/retirer', maisonsController.removeResidentFromMaison);

module.exports = router;
