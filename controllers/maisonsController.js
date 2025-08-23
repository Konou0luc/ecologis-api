const Maison = require('../models/Maison');
const User = require('../models/User');

// Créer une maison
const createMaison = async (req, res) => {
  try {
    const { nomMaison, adresse, description, tarifKwh } = req.body;

    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent créer des maisons' });
    }

    // Créer la maison
    const maison = new Maison({
      nomMaison,
      proprietaireId: req.user._id,
      adresse,
      description,
      tarifKwh: tarifKwh !== undefined ? Number(tarifKwh) : undefined
    });

    await maison.save();

    res.status(201).json({
      message: 'Maison créée avec succès',
      maison
    });
  } catch (error) {
    console.error('Erreur lors de la création de la maison:', error);
    res.status(500).json({ message: 'Erreur lors de la création de la maison' });
  }
};

// Obtenir les maisons d'un propriétaire
const getMaisons = async (req, res) => {
  try {
    let maisons;

    if (req.user.role === 'proprietaire') {
      // Le propriétaire voit toutes ses maisons
      maisons = await Maison.find({ proprietaireId: req.user._id })
        .populate('listeResidents', 'nom prenom email telephone')
        .sort({ createdAt: -1 });
    } else {
      // Le résident voit les maisons où il habite
      maisons = await Maison.find({ listeResidents: req.user._id })
        .populate('proprietaireId', 'nom prenom email')
        .populate('listeResidents', 'nom prenom email telephone')
        .sort({ createdAt: -1 });
    }

    res.json({
      maisons,
      count: maisons.length
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des maisons:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des maisons' });
  }
};

// Obtenir une maison spécifique
const getMaison = async (req, res) => {
  try {
    const { id } = req.params;

    let maison;
    if (req.user.role === 'proprietaire') {
      maison = await Maison.findOne({
        _id: id,
        proprietaireId: req.user._id
      }).populate('listeResidents', 'nom prenom email telephone');
    } else {
      maison = await Maison.findOne({
        _id: id,
        listeResidents: req.user._id
      }).populate('proprietaireId', 'nom prenom email')
        .populate('listeResidents', 'nom prenom email telephone');
    }

    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    res.json({ maison });
  } catch (error) {
    console.error('Erreur lors de la récupération de la maison:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la maison' });
  }
};

// Mettre à jour une maison
const updateMaison = async (req, res) => {
  try {
    const { id } = req.params;
    const { nomMaison, adresse, description } = req.body;

    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent modifier des maisons' });
    }

    // Trouver la maison
    const maison = await Maison.findOne({
      _id: id,
      proprietaireId: req.user._id
    });

    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    // Mettre à jour les champs
    if (nomMaison) maison.nomMaison = nomMaison;
    if (adresse) maison.adresse = adresse;
    if (description !== undefined) maison.description = description;

    await maison.save();

    res.json({
      message: 'Maison mise à jour avec succès',
      maison
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la maison:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la maison' });
  }
};

// Supprimer une maison
const deleteMaison = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent supprimer des maisons' });
    }

    // Trouver la maison
    const maison = await Maison.findOne({
      _id: id,
      proprietaireId: req.user._id
    });

    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    // Vérifier qu'il n'y a pas de résidents
    if (maison.listeResidents.length > 0) {
      return res.status(400).json({ 
        message: 'Impossible de supprimer une maison qui a des résidents' 
      });
    }

    await Maison.findByIdAndDelete(id);

    res.json({ message: 'Maison supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la maison:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la maison' });
  }
};

// Mettre à jour le tarif d'une maison (propriétaire uniquement)
const updateMaisonTarif = async (req, res) => {
  try {
    const { id } = req.params;
    const { tarifKwh } = req.body;

    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent modifier le tarif' });
    }

    if (tarifKwh === undefined || Number.isNaN(Number(tarifKwh)) || Number(tarifKwh) < 0) {
      return res.status(400).json({ message: 'tarifKwh invalide' });
    }

    const maison = await Maison.findOne({ _id: id, proprietaireId: req.user._id });
    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    maison.tarifKwh = Number(tarifKwh);
    await maison.save();

    res.json({ message: 'Tarif mis à jour avec succès', maison: { _id: maison._id, tarifKwh: maison.tarifKwh } });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du tarif:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du tarif' });
  }
};

// Ajouter un résident à une maison
const addResidentToMaison = async (req, res) => {
  try {
    const { maisonId, residentId } = req.body;

    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent ajouter des résidents' });
    }

    // Vérifier que la maison appartient au propriétaire
    const maison = await Maison.findOne({
      _id: maisonId,
      proprietaireId: req.user._id
    });

    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    // Vérifier que le résident appartient au propriétaire
    const resident = await User.findOne({
      _id: residentId,
      idProprietaire: req.user._id,
      role: 'resident'
    });

    if (!resident) {
      return res.status(404).json({ message: 'Résident non trouvé' });
    }

    // Ajouter le résident à la maison
    await maison.ajouterResident(residentId);

    res.json({
      message: 'Résident ajouté à la maison avec succès',
      maison
    });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du résident:', error);
    res.status(500).json({ message: 'Erreur lors de l\'ajout du résident' });
  }
};

// Retirer un résident d'une maison
const removeResidentFromMaison = async (req, res) => {
  try {
    const { maisonId, residentId } = req.body;

    // Vérifier que l'utilisateur est un propriétaire
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Seuls les propriétaires peuvent retirer des résidents' });
    }

    // Vérifier que la maison appartient au propriétaire
    const maison = await Maison.findOne({
      _id: maisonId,
      proprietaireId: req.user._id
    });

    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    // Retirer le résident de la maison
    await maison.retirerResident(residentId);

    res.json({
      message: 'Résident retiré de la maison avec succès',
      maison
    });
  } catch (error) {
    console.error('Erreur lors du retrait du résident:', error);
    res.status(500).json({ message: 'Erreur lors du retrait du résident' });
  }
};

module.exports = {
  createMaison,
  getMaisons,
  getMaison,
  updateMaison,
  deleteMaison,
  addResidentToMaison,
  removeResidentFromMaison,
  updateMaisonTarif
};
