const User = require('../models/User');
const Maison = require('../models/Maison');
const Consommation = require('../models/Consommation');
const Facture = require('../models/Facture');
const Abonnement = require('../models/Abonnement');

// Dashboard - Statistiques générales
const getDashboardStats = async (req, res) => {
  try {
    // Compter les utilisateurs par rôle
    const totalUsers = await User.countDocuments();
    const totalProprietaires = await User.countDocuments({ role: 'proprietaire' });
    const totalResidents = await User.countDocuments({ role: 'resident' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });

    // Compter les maisons
    const totalMaisons = await Maison.countDocuments();

    // Statistiques des consommations
    const totalConsommations = await Consommation.countDocuments();
    const totalKwh = await Consommation.aggregate([
      { $group: { _id: null, total: { $sum: '$kwh' } } }
    ]);
    const totalMontantConsommations = await Consommation.aggregate([
      { $group: { _id: null, total: { $sum: '$montant' } } }
    ]);

    // Statistiques des factures
    const totalFactures = await Facture.countDocuments();
    const facturesPayees = await Facture.countDocuments({ statut: 'payée' });
    const facturesEnRetard = await Facture.countDocuments({ statut: 'en retard' });
    const facturesEnAttente = await Facture.countDocuments({ statut: 'en attente' });

    // Revenus totaux
    const revenusTotaux = await Facture.aggregate([
      { $match: { statut: 'payée' } },
      { $group: { _id: null, total: { $sum: '$montant' } } }
    ]);

    // Consommations des 6 derniers mois
    const sixMoisAgo = new Date();
    sixMoisAgo.setMonth(sixMoisAgo.getMonth() - 6);
    
    const consommationsRecentes = await Consommation.aggregate([
      { $match: { createdAt: { $gte: sixMoisAgo } } },
      {
        $group: {
          _id: {
            annee: '$annee',
            mois: '$mois'
          },
          totalKwh: { $sum: '$kwh' },
          totalMontant: { $sum: '$montant' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.annee': 1, '_id.mois': 1 } }
    ]);

    // Factures des 6 derniers mois
    const facturesRecentes = await Facture.aggregate([
      { $match: { dateEmission: { $gte: sixMoisAgo } } },
      {
        $group: {
          _id: {
            annee: { $year: '$dateEmission' },
            mois: { $month: '$dateEmission' }
          },
          totalMontant: { $sum: '$montant' },
          count: { $sum: 1 },
          payees: {
            $sum: { $cond: [{ $eq: ['$statut', 'payée'] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.annee': 1, '_id.mois': 1 } }
    ]);

    // Top 5 des maisons les plus consommatrices
    const topMaisons = await Consommation.aggregate([
      {
        $group: {
          _id: '$maisonId',
          totalKwh: { $sum: '$kwh' },
          totalMontant: { $sum: '$montant' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalKwh: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'maisons',
          localField: '_id',
          foreignField: '_id',
          as: 'maison'
        }
      },
      { $unwind: '$maison' }
    ]);

    res.json({
      utilisateurs: {
        total: totalUsers,
        proprietaires: totalProprietaires,
        residents: totalResidents,
        admins: totalAdmins
      },
      maisons: {
        total: totalMaisons
      },
      consommations: {
        total: totalConsommations,
        totalKwh: totalKwh[0]?.total || 0,
        totalMontant: totalMontantConsommations[0]?.total || 0
      },
      factures: {
        total: totalFactures,
        payees: facturesPayees,
        enRetard: facturesEnRetard,
        enAttente: facturesEnAttente,
        revenusTotaux: revenusTotaux[0]?.total || 0
      },
      graphiques: {
        consommationsParMois: consommationsRecentes,
        facturesParMois: facturesRecentes,
        topMaisons
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques dashboard:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des statistiques' });
  }
};

// Obtenir tous les utilisateurs (admin)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (page - 1) * limit;

    // Construire la requête
    const query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { prenom: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-motDePasse -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des utilisateurs' });
  }
};

// Obtenir toutes les maisons (admin)
const getAllMaisons = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    // Construire la requête
    const query = {};
    if (search) {
      query.$or = [
        { nomMaison: { $regex: search, $options: 'i' } },
        { adresse: { $regex: search, $options: 'i' } }
      ];
    }

    const maisons = await Maison.find(query)
      .populate('proprietaireId', 'nom prenom email')
      .populate('listeResidents', 'nom prenom email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Maison.countDocuments(query);

    res.json({
      maisons,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des maisons:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des maisons' });
  }
};

// Obtenir toutes les consommations (admin)
const getAllConsommations = async (req, res) => {
  try {
    const { page = 1, limit = 10, annee, mois, maisonId } = req.query;
    const skip = (page - 1) * limit;

    // Construire la requête
    const query = {};
    if (annee) query.annee = parseInt(annee);
    if (mois) query.mois = parseInt(mois);
    if (maisonId) query.maisonId = maisonId;

    const consommations = await Consommation.find(query)
      .populate('residentId', 'nom prenom email')
      .populate('maisonId', 'nomMaison adresse')
      .sort({ annee: -1, mois: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Consommation.countDocuments(query);

    // Statistiques
    const stats = await Consommation.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalKwh: { $sum: '$kwh' },
          totalMontant: { $sum: '$montant' },
          moyenneKwh: { $avg: '$kwh' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      consommations,
      statistiques: stats[0] || { totalKwh: 0, totalMontant: 0, moyenneKwh: 0, count: 0 },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des consommations:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des consommations' });
  }
};

// Obtenir toutes les factures (admin)
const getAllFactures = async (req, res) => {
  try {
    const { page = 1, limit = 10, statut, annee, maisonId } = req.query;
    const skip = (page - 1) * limit;

    // Construire la requête
    const query = {};
    if (statut) query.statut = statut;
    if (maisonId) query.maisonId = maisonId;
    if (annee) {
      query.dateEmission = {
        $gte: new Date(parseInt(annee), 0, 1),
        $lt: new Date(parseInt(annee) + 1, 0, 1)
      };
    }

    const factures = await Facture.find(query)
      .populate('residentId', 'nom prenom email')
      .populate('maisonId', 'nomMaison adresse')
      .populate('consommationId', 'kwh mois annee')
      .sort({ dateEmission: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Facture.countDocuments(query);

    // Statistiques
    const stats = await Facture.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalMontant: { $sum: '$montant' },
          totalPaye: {
            $sum: { $cond: [{ $eq: ['$statut', 'payée'] }, '$montant', 0] }
          },
          totalImpaye: {
            $sum: { $cond: [{ $ne: ['$statut', 'payée'] }, '$montant', 0] }
          },
          count: { $sum: 1 },
          payees: { $sum: { $cond: [{ $eq: ['$statut', 'payée'] }, 1, 0] } },
          enRetard: { $sum: { $cond: [{ $eq: ['$statut', 'en retard'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      factures,
      statistiques: stats[0] || {
        totalMontant: 0,
        totalPaye: 0,
        totalImpaye: 0,
        count: 0,
        payees: 0,
        enRetard: 0
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des factures' });
  }
};

// Obtenir tous les abonnements (admin)
const getAllAbonnements = async (req, res) => {
  try {
    const { page = 1, limit = 10, statut } = req.query;
    const skip = (page - 1) * limit;

    // Construire la requête
    const query = {};
    if (statut) query.statut = statut;

    const abonnements = await Abonnement.find(query)
      .populate('proprietaireId', 'nom prenom email')
      .sort({ dateDebut: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Abonnement.countDocuments(query);

    res.json({
      abonnements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des abonnements:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des abonnements' });
  }
};

// Supprimer un utilisateur (admin)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur existe
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Ne pas permettre la suppression d'un admin si c'est le dernier
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Impossible de supprimer le dernier administrateur' });
      }
    }

    await User.findByIdAndDelete(id);

    res.json({ message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de l\'utilisateur' });
  }
};

// Supprimer une maison (admin)
const deleteMaison = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la maison existe
    const maison = await Maison.findById(id);
    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    // Supprimer les consommations et factures liées
    await Consommation.deleteMany({ maisonId: id });
    await Facture.deleteMany({ maisonId: id });

    await Maison.findByIdAndDelete(id);

    res.json({ message: 'Maison supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la maison:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la maison' });
  }
};

// Fonction pour obtenir tous les résidents avec pagination et filtres
const getResidents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, statut } = req.query;
    const query = { role: 'resident' };

    if (search) {
      query.$or = [
        { nom: { $regex: search, $options: 'i' } },
        { prenom: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      select: '-motDePasse -refreshToken', // Exclure les champs sensibles
    };

    // Pagination manuelle en attendant le déploiement
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const residents = await User.find(query)
      .select('-motDePasse -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);

    // Enrichir avec les données des maisons et consommations
    const enrichedResidents = await Promise.all(
      residents.map(async (resident) => {
        // Trouver la maison du résident
        const maison = await Maison.findOne({ 
          listeResidents: resident._id 
        }).select('nomMaison adresse');

        // Calculer les statistiques
        const consommations = await Consommation.find({ 
          residentId: resident._id 
        });
        
        const totalKwh = consommations.reduce((sum, cons) => sum + (cons.kwh || 0), 0);
        const totalFactures = await Facture.countDocuments({ 
          residentId: resident._id 
        });

        return {
          ...resident.toObject(),
          maison: maison,
          statistiques: {
            totalKwh,
            totalFactures
          }
        };
      })
    );

    res.json({
      residents: enrichedResidents,
      pagination: {
        total: total,
        limit: parseInt(limit),
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des résidents:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des résidents' });
  }
};

// Fonction pour supprimer un résident
const deleteResident = async (req, res) => {
  try {
    const { id } = req.params;
    const resident = await User.findByIdAndDelete(id);

    if (!resident) {
      return res.status(404).json({ message: 'Résident non trouvé' });
    }

    res.json({ message: 'Résident supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du résident:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression du résident' });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getAllMaisons,
  getAllConsommations,
  getAllFactures,
  getAllAbonnements,
  deleteUser,
  deleteMaison,
  getResidents,
  deleteResident
};
