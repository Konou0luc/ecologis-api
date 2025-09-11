const mongoose = require('mongoose');
const User = require('../models/User');
const Maison = require('../models/Maison');
const { generateTemporaryPassword } = require('../utils/passwordUtils');
const { sendWhatsAppCredentials } = require('../utils/whatsappUtils');

// Ajouter un résident
const addResident = async (req, res) => {
  try {
    const { nom, prenom, email, telephone, maisonId } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }

    // Vérifier que la maison appartient bien au propriétaire connecté
    const maison = await Maison.findOne({
      _id: maisonId,
      proprietaireId: req.user._id
    });

    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    // Générer un mot de passe temporaire
    const motDePasseTemporaire = generateTemporaryPassword();

    // Créer le résident et stocker maisonId
    const resident = new User({
      nom,
      prenom,
      email,
      telephone,
      motDePasse: motDePasseTemporaire,
      role: 'resident',
      idProprietaire: req.user._id,
      maisonId: mongoose.Types.ObjectId(maisonId), // 🔥 on stocke l'ObjectId
      firstLogin: true
    });

    await resident.save();

    // Ajouter le résident dans la maison
    await maison.ajouterResident(resident._id);

    // Envoyer les identifiants via WhatsApp (simulation)
    const credentialsSent = await sendWhatsAppCredentials(
      telephone,
      email,
      motDePasseTemporaire
    );

    res.status(201).json({
      message: 'Résident ajouté avec succès',
      resident: {
        _id: resident._id,
        nom: resident.nom,
        prenom: resident.prenom,
        email: resident.email,
        telephone: resident.telephone,
        maisonId: resident.maisonId, // 🔥 inclure la maison dans la réponse
        firstLogin: resident.firstLogin
      },
      credentialsSent,
      temporaryPassword: motDePasseTemporaire // ⚠️ À retirer en production
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du résident:", error);
    res.status(500).json({ message: "Erreur lors de l'ajout du résident" });
  }
};

// Lister les résidents d'un propriétaire
const getResidents = async (req, res) => {
  try {
    const residents = await User.find({
      idProprietaire: req.user._id,
      role: 'resident'
    }).select('-motDePasse -refreshToken');

    // Ajouter le nom de la maison à chaque résident
    const residentsWithHouse = await Promise.all(
      residents.map(async (resident) => {
        const maison = await Maison.findOne({ _id: resident.maisonId });
        return {
          ...resident.toObject(),
          maison: maison
            ? { _id: maison._id, nomMaison: maison.nomMaison }
            : null
        };
      })
    );

    res.json({
      residents: residentsWithHouse,
      count: residentsWithHouse.length
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des résidents:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des résidents" });
  }
};

// Obtenir un résident spécifique
const getResident = async (req, res) => {
  try {
    const { id } = req.params;

    const resident = await User.findOne({
      _id: id,
      idProprietaire: req.user._id,
      role: 'resident'
    }).select('-motDePasse -refreshToken');

    if (!resident) {
      return res.status(404).json({ message: "Résident non trouvé" });
    }

    const maison = resident.maisonId
      ? await Maison.findById(resident.maisonId)
      : null;

    res.json({
      resident: {
        ...resident.toObject(),
        maison: maison
          ? { _id: maison._id, nomMaison: maison.nomMaison }
          : null
      }
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du résident:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération du résident" });
  }
};

// Supprimer un résident
const deleteResident = async (req, res) => {
  try {
    const { id } = req.params;

    const resident = await User.findOne({
      _id: id,
      idProprietaire: req.user._id,
      role: 'resident'
    });

    if (!resident) {
      return res.status(404).json({ message: "Résident non trouvé" });
    }

    // Retirer le résident de la maison associée
    if (resident.maisonId) {
      await Maison.updateOne(
        { _id: resident.maisonId },
        { $pull: { listeResidents: resident._id } }
      );
    }

    await User.findByIdAndDelete(resident._id);

    res.json({ message: "Résident supprimé avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression du résident:", error);
    res.status(500).json({ message: "Erreur lors de la suppression du résident" });
  }
};

// Mettre à jour un résident
const updateResident = async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, telephone, maisonId } = req.body;

    const resident = await User.findOne({
      _id: id,
      idProprietaire: req.user._id,
      role: 'resident'
    });

    if (!resident) {
      return res.status(404).json({ message: "Résident non trouvé" });
    }

    if (email && email !== resident.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }
    }

    if (nom) resident.nom = nom;
    if (prenom) resident.prenom = prenom;
    if (email) resident.email = email;
    if (telephone) resident.telephone = telephone;
    if (maisonId) resident.maisonId = mongoose.Types.ObjectId(maisonId); // 🔥 update maison

    await resident.save();

    res.json({
      message: "Résident mis à jour avec succès",
      resident: {
        _id: resident._id,
        nom: resident.nom,
        prenom: resident.prenom,
        email: resident.email,
        telephone: resident.telephone,
        maisonId: resident.maisonId,
        firstLogin: resident.firstLogin
      }
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du résident:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour du résident" });
  }
};

module.exports = {
  addResident,
  getResidents,
  getResident,
  deleteResident,
  updateResident
};
