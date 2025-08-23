const Abonnement = require('../models/Abonnement');

// Middleware pour vérifier que l'abonnement est actif
const checkSubscription = async (req, res, next) => {
  try {
    // Si l'utilisateur n'est pas un propriétaire, passer au suivant
    if (req.user.role !== 'proprietaire') {
      return next();
    }

    // Vérifier si le propriétaire a un abonnement
    if (!req.user.abonnementId) {
      return res.status(403).json({ 
        message: 'Aucun abonnement actif',
        error: 'NO_SUBSCRIPTION'
      });
    }

    // Récupérer l'abonnement
    const abonnement = await Abonnement.findById(req.user.abonnementId);
    
    if (!abonnement) {
      return res.status(403).json({ 
        message: 'Abonnement non trouvé',
        error: 'SUBSCRIPTION_NOT_FOUND'
      });
    }

    // Vérifier si l'abonnement est actif
    if (!abonnement.isActif()) {
      return res.status(403).json({ 
        message: 'Abonnement expiré',
        error: 'SUBSCRIPTION_EXPIRED',
        dateExpiration: abonnement.dateFin,
        joursRestants: abonnement.joursRestants()
      });
    }

    // Ajouter l'abonnement à la requête pour utilisation ultérieure
    req.abonnement = abonnement;
    next();
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'abonnement:', error);
    return res.status(500).json({ 
      message: 'Erreur lors de la vérification de l\'abonnement' 
    });
  }
};

// Middleware pour vérifier le quota de résidents
const checkResidentQuota = async (req, res, next) => {
  try {
    if (!req.abonnement) {
      return res.status(403).json({ 
        message: 'Abonnement requis pour cette opération' 
      });
    }

    // Compter le nombre de résidents actuels du propriétaire
    const User = require('../models/User');
    const nbResidentsActuels = await User.countDocuments({
      idProprietaire: req.user._id,
      role: 'resident'
    });

    // Vérifier si on peut ajouter un résident
    if (nbResidentsActuels >= req.abonnement.nbResidentsMax) {
      return res.status(403).json({ 
        message: `Quota de résidents atteint (${req.abonnement.nbResidentsMax} maximum)`,
        error: 'QUOTA_EXCEEDED',
        quotaActuel: nbResidentsActuels,
        quotaMaximum: req.abonnement.nbResidentsMax
      });
    }

    req.nbResidentsActuels = nbResidentsActuels;
    next();
  } catch (error) {
    console.error('Erreur lors de la vérification du quota:', error);
    return res.status(500).json({ 
      message: 'Erreur lors de la vérification du quota' 
    });
  }
};

// Middleware pour vérifier si l'abonnement expire bientôt (dans les 7 jours)
const checkSubscriptionExpiry = async (req, res, next) => {
  try {
    if (!req.abonnement) {
      return next();
    }

    const joursRestants = req.abonnement.joursRestants();
    
    if (joursRestants <= 7 && joursRestants > 0) {
      // Ajouter un avertissement dans la réponse
      res.locals.subscriptionWarning = {
        message: `Votre abonnement expire dans ${joursRestants} jour(s)`,
        joursRestants,
        dateExpiration: req.abonnement.dateFin
      };
    }

    next();
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'expiration:', error);
    next(); // Continuer même en cas d'erreur
  }
};

module.exports = {
  checkSubscription,
  checkResidentQuota,
  checkSubscriptionExpiry
};
