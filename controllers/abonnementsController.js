const Abonnement = require('../models/Abonnement');
const User = require('../models/User');
const { sendSubscriptionExpiryNotification } = require('../utils/whatsappUtils');

// Obtenir la liste des offres d'abonnement
const getOffres = async (req, res) => {
  try {
    const offres = [
      {
        type: 'basic',
        nom: 'Basic',
        prix: 500,
        nbResidentsMax: 5,
        description: 'Idéal pour les petites propriétés',
        fonctionnalites: [
          'Gestion jusqu\'à 5 résidents',
          'Génération de factures',
          'Historique des consommations',
          'Notifications WhatsApp'
        ]
      },
      {
        type: 'premium',
        nom: 'Premium',
        prix: 1000,
        nbResidentsMax: 15,
        description: 'Parfait pour les propriétés moyennes',
        fonctionnalites: [
          'Gestion jusqu\'à 15 résidents',
          'Génération de factures',
          'Historique des consommations',
          'Notifications WhatsApp',
          'Statistiques avancées',
          'Support prioritaire'
        ]
      },
      {
        type: 'enterprise',
        nom: 'Enterprise',
        prix: 2000,
        nbResidentsMax: 50,
        description: 'Pour les grandes propriétés',
        fonctionnalites: [
          'Gestion jusqu\'à 50 résidents',
          'Génération de factures',
          'Historique des consommations',
          'Notifications WhatsApp',
          'Statistiques avancées',
          'Support prioritaire',
          'API personnalisée',
          'Formation incluse'
        ]
      }
    ];

    res.json({ offres });
  } catch (error) {
    console.error('Erreur lors de la récupération des offres:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des offres' });
  }
};

// Souscrire à un abonnement
const souscrire = async (req, res) => {
  try {
    const { type } = req.body;

    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent souscrire à un abonnement' });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    if (req.user.abonnementId) {
      const existingAbonnement = await Abonnement.findById(req.user.abonnementId);
      if (existingAbonnement && existingAbonnement.isActif()) {
        return res.status(400).json({ 
          message: 'Vous avez déjà un abonnement actif',
          abonnement: existingAbonnement
        });
      }
    }

    // Définir les détails de l'abonnement selon le type
    const offres = {
      basic: { prix: 500, nbResidentsMax: 5 },
      premium: { prix: 1000, nbResidentsMax: 15 },
      enterprise: { prix: 2000, nbResidentsMax: 50 }
    };

    const offre = offres[type];
    if (!offre) {
      return res.status(400).json({ message: 'Type d\'abonnement invalide' });
    }

    // Calculer les dates
    const dateDebut = new Date();
    const dateFin = new Date();
    dateFin.setMonth(dateFin.getMonth() + 1);

    // Créer l'abonnement
    const abonnement = new Abonnement({
      type,
      prix: offre.prix,
      nbResidentsMax: offre.nbResidentsMax,
      dateDebut,
      dateFin,
      statut: 'actif',
      proprietaireId: req.user._id
    });

    await abonnement.save();

    // Mettre à jour l'utilisateur
    req.user.abonnementId = abonnement._id;
    await req.user.save();

    res.status(201).json({
      message: 'Abonnement souscrit avec succès',
      abonnement
    });
  } catch (error) {
    console.error('Erreur lors de la souscription:', error);
    res.status(500).json({ message: 'Erreur lors de la souscription' });
  }
};

// Renouveler un abonnement
const renouveler = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent renouveler un abonnement' });
    }

    // Vérifier que l'utilisateur a un abonnement
    if (!req.user.abonnementId) {
      return res.status(400).json({ message: 'Aucun abonnement à renouveler' });
    }

    const abonnement = await Abonnement.findById(req.user.abonnementId);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement non trouvé' });
    }

    // Renouveler l'abonnement
    await abonnement.renouveler();

    res.json({
      message: 'Abonnement renouvelé avec succès',
      abonnement
    });
  } catch (error) {
    console.error('Erreur lors du renouvellement:', error);
    res.status(500).json({ message: 'Erreur lors du renouvellement' });
  }
};

// Obtenir les détails de l'abonnement actuel
const getAbonnementActuel = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent consulter leur abonnement' });
    }

    if (!req.user.abonnementId) {
      return res.status(404).json({ message: 'Aucun abonnement trouvé' });
    }

    const abonnement = await Abonnement.findById(req.user.abonnementId);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement non trouvé' });
    }

    // Compter le nombre de résidents actuels
    const nbResidentsActuels = await User.countDocuments({
      idProprietaire: req.user._id,
      role: 'resident'
    });

    res.json({
      abonnement,
      statistiques: {
        nbResidentsActuels,
        nbResidentsMax: abonnement.nbResidentsMax,
        joursRestants: abonnement.joursRestants(),
        isActif: abonnement.isActif()
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'abonnement:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'abonnement' });
  }
};

// Annuler un abonnement
const annuler = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent annuler un abonnement' });
    }

    if (!req.user.abonnementId) {
      return res.status(400).json({ message: 'Aucun abonnement à annuler' });
    }

    const abonnement = await Abonnement.findById(req.user.abonnementId);
    if (!abonnement) {
      return res.status(404).json({ message: 'Abonnement non trouvé' });
    }

    // Marquer l'abonnement comme suspendu
    abonnement.statut = 'suspendu';
    await abonnement.save();

    // Supprimer la référence de l'utilisateur
    req.user.abonnementId = null;
    await req.user.save();

    res.json({
      message: 'Abonnement annulé avec succès',
      abonnement
    });
  } catch (error) {
    console.error('Erreur lors de l\'annulation:', error);
    res.status(500).json({ message: 'Erreur lors de l\'annulation' });
  }
};

// Obtenir l'historique des abonnements
const getHistorique = async (req, res) => {
  try {
    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent consulter l\'historique' });
    }

    const abonnements = await Abonnement.find({ proprietaireId: req.user._id })
      .sort({ dateDebut: -1 });

    res.json({
      abonnements,
      total: abonnements.length
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de l\'historique' });
  }
};

module.exports = {
  getOffres,
  souscrire,
  renouveler,
  getAbonnementActuel,
  annuler,
  getHistorique
};
