const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Abonnement = require('../models/Abonnement');
const { generateTemporaryPassword } = require('../utils/passwordUtils');

// Générer les tokens JWT
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

// Enregistrement d'un propriétaire
const register = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, motDePasse } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Créer le propriétaire
    const proprietaire = new User({
      nom,
      prenom,
      email,
      telephone,
      motDePasse,
      role: 'proprietaire'
    });

    await proprietaire.save();

    // Générer les tokens
    const { accessToken, refreshToken } = generateTokens(proprietaire._id);

    // Sauvegarder le refresh token
    proprietaire.refreshToken = refreshToken;
    await proprietaire.save();

    res.status(201).json({
      message: 'Compte propriétaire créé avec succès',
      user: proprietaire,
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement:', error);
    res.status(500).json({ message: 'Erreur lors de la création du compte' });
  }
};

const FREE_MODE = process.env.FREE_MODE === 'true';

// Connexion
const login = async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    // Normaliser les identifiants (évite les erreurs de casse/espaces)
    const normalizedEmail = (email || '').toString().trim().toLowerCase();
    const normalizedPassword = (motDePasse || '').toString().trim();

    // Vérifier si l'utilisateur existe (par email normalisé ou téléphone saisi à la place de l'email)
    let user = await User.findOne({ email: normalizedEmail });
    if (!user && email) {
      // Si l'utilisateur a saisi son téléphone à la place de l'email
      user = await User.findOne({ telephone: (email || '').toString().trim() });
    }
    if (!user) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(normalizedPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // Générer les tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Sauvegarder le refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // Récupérer l'abonnement si c'est un propriétaire
    let abonnement = null;
    if (FREE_MODE) {
      const now = new Date();
      const future = new Date(now);
      future.setFullYear(future.getFullYear() + 5);
      abonnement = {
        statut: 'actif',
        isActive: true,
        dateDebut: now,
        dateFin: future,
        nbResidentsMax: 9999,
      };
    } else if (user.role === 'proprietaire' && user.abonnementId) {
      abonnement = await Abonnement.findById(user.abonnementId);
      if (abonnement) {
        abonnement.isActif();
        await abonnement.save();
      }
    }

    res.json({
      message: 'Connexion réussie',
      user,
      accessToken,
      refreshToken,
      abonnement
    });
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token requis' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Refresh token invalide' });
    }

    // Générer de nouveaux tokens
    const tokens = generateTokens(user._id);

    // Sauvegarder le nouveau refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (error) {
    console.error('Erreur lors du refresh token:', error);
    res.status(401).json({ message: 'Refresh token invalide' });
  }
};

// Déconnexion
const logout = async (req, res) => {
  try {
    // Supprimer le refresh token
    req.user.refreshToken = null;
    await req.user.save();

    res.json({ message: 'Déconnexion réussie' });
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({ message: 'Erreur lors de la déconnexion' });
  }
};

// Changement de mot de passe (pour premier login)
const resetPassword = async (req, res) => {
  try {
    const { nouveauMotDePasse } = req.body;

    if (!req.user.firstLogin) {
      return res.status(400).json({ message: 'Cette opération n\'est pas nécessaire' });
    }

    // Mettre à jour le mot de passe
    req.user.motDePasse = nouveauMotDePasse;
    req.user.firstLogin = false;
    await req.user.save();

    res.json({ 
      message: 'Mot de passe mis à jour avec succès',
      user: req.user
    });
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
  }
};

// Changement de mot de passe normal
const changePassword = async (req, res) => {
  try {
    const { motDePasseActuel, nouveauMotDePasse } = req.body;

    // Recharger l'utilisateur avec le mot de passe (le middleware exclut ce champ)
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier l'ancien mot de passe
    const isPasswordValid = await user.comparePassword(motDePasseActuel);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Mot de passe actuel incorrect' });
    }

    // Mettre à jour le mot de passe
    user.motDePasse = nouveauMotDePasse;
    await user.save();

    res.json({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({ message: 'Erreur lors du changement de mot de passe' });
  }
};

// Récupérer les informations de l'utilisateur connecté
const getCurrentUser = async (req, res) => {
  try {
    console.log('🔍 [API] Récupération des données utilisateur:', req.user._id);
    
    // Récupérer l'utilisateur avec ses données complètes
    const user = await User.findById(req.user._id).select('-motDePasse -refreshToken');
    
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Récupérer l'abonnement si c'est un propriétaire
    let abonnement = null;
    if (FREE_MODE) {
      const now = new Date();
      const future = new Date(now);
      future.setFullYear(future.getFullYear() + 5);
      abonnement = {
        statut: 'actif',
        isActive: true,
        dateDebut: now,
        dateFin: future,
        nbResidentsMax: 9999,
      };
    } else if (user.role === 'proprietaire' && user.abonnementId) {
      abonnement = await Abonnement.findById(user.abonnementId);
      if (abonnement) {
        abonnement.isActif();
        await abonnement.save();
      }
    }

    // Récupérer les maisons
    let maisons = [];
    const Maison = require('../models/Maison');
    if (user.role === 'proprietaire') {
      maisons = await Maison.find({ proprietaireId: user._id });
    } else if (user.role === 'resident') {
      // Pour les résidents, récupérer leur maison via la liste des résidents
      const maison = await Maison.findOne({ listeResidents: user._id });
      if (maison) {
        maisons = [maison];
      }
    }

    // Récupérer les résidents si c'est un propriétaire
    let residents = [];
    if (user.role === 'proprietaire') {
      residents = await User.find({ idProprietaire: user._id, role: 'resident' }).select('-motDePasse -refreshToken');
    }

    console.log('✅ [API] Données utilisateur récupérées avec succès');
    
    res.json({
      user,
      abonnement,
      maisons,
      residents,
      message: 'Données utilisateur récupérées avec succès'
    });
  } catch (error) {
    console.error('💥 [API] Erreur lors de la récupération des données utilisateur:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des données utilisateur' });
  }
};

// Enregistrer/mettre à jour le device token FCM de l'utilisateur connecté
const setDeviceToken = async (req, res) => {
  try {
    const { deviceToken } = req.body;

    if (!deviceToken || typeof deviceToken !== 'string') {
      return res.status(400).json({ message: 'deviceToken requis' });
    }

    req.user.deviceToken = deviceToken;
    await req.user.save();

    return res.json({
      message: 'Device token mis à jour avec succès',
      deviceToken: req.user.deviceToken,
    });
  } catch (error) {
    console.error('💥 [API] Erreur lors de la mise à jour du deviceToken:', error);
    return res.status(500).json({ message: 'Erreur lors de la mise à jour du device token' });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  resetPassword,
  changePassword,
  getCurrentUser,
  setDeviceToken
};
