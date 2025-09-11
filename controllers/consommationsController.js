const Consommation = require("../models/Consommation");
const User = require("../models/User");
const Maison = require("../models/Maison");
const notifications = require("../utils/notifications");
// Enregistrer une consommation
const addConsommation = async (req, res) => {
  try {
    const {
      residentId,
      maisonId,
      previousIndex,
      currentIndex,
      mois,
      annee,
      commentaire,
    } = req.body;

    // Vérifier que l'utilisateur est autorisé
    if (req.user.role === "proprietaire") {
      // Vérifier résident
      const resident = await User.findOne({
        _id: residentId,
        idProprietaire: req.user._id,
        role: "resident",
      });
      if (!resident)
        return res.status(404).json({ message: "Résident non trouvé" });

      // Vérifier maison
      const maison = await Maison.findOne({
        _id: maisonId,
        proprietaireId: req.user._id,
      });
      if (!maison)
        return res.status(404).json({ message: "Maison non trouvée" });
    } else {
      // Le résident enregistre pour lui-même
      if (residentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Vous ne pouvez enregistrer que votre propre consommation",
        });
      }
      const maison = await Maison.findOne({
        _id: maisonId,
        listeResidents: req.user._id,
      });
      if (!maison)
        return res.status(404).json({ message: "Maison non trouvée" });
    }

    // Vérifier doublon pour la période
    const existingConsommation = await Consommation.findOne({
      residentId,
      maisonId,
      mois,
      annee,
    });
    if (existingConsommation) {
      return res.status(400).json({
        message: "Une consommation existe déjà pour cette période",
        existingConsommation,
      });
    }

    // Calcul du kWh
    const kwh = currentIndex - previousIndex;
    if (kwh < 0) {
      return res
        .status(400)
        .json({ message: "L'index actuel doit être ≥ à l'ancien index" });
    }

    // Récupérer la maison pour calcul du montant
    const maison = await Maison.findById(maisonId);
    if (!maison) {
      return res.status(404).json({ message: "Maison non trouvée" });
    }
    const montant = kwh * maison.tarifKwh;

    // Créer la consommation
    const consommation = new Consommation({
      residentId,
      maisonId,
      previousIndex,
      currentIndex,
      mois,
      annee,
      commentaire,
      kwh,
      montant,
    });

    await consommation.save();

    // Vérifier consommation excessive par rapport aux 3 dernières
    const troisDernieres = await Consommation.find({
      residentId,
      _id: { $ne: consommation._id },
    })
      .sort({ annee: -1, mois: -1, createdAt: -1 })
      .limit(3);

    if (troisDernieres.length > 0) {
      const moyenne =
        troisDernieres.reduce((sum, c) => sum + c.kwh, 0) /
        troisDernieres.length;
      if (consommation.kwh > moyenne) {
        const message = `Attention ! Votre consommation de ${
          consommation.kwh
        } kWh dépasse votre moyenne habituelle de ${moyenne.toFixed(
          1
        )} kWh. Préparez-vous à une facture plus élevée.`;
        await notifications.envoyer(residentId, message);
      }
    }

    res.status(201).json({
      message: "Consommation enregistrée avec succès",
      consommation,
    });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la consommation:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de l'enregistrement de la consommation" });
  }
};

// Obtenir l'historique des consommations d'un résident
const getConsommationsByResident = async (req, res) => {
  try {
    const { residentId } = req.params;
    const { annee, mois } = req.query;

    // Vérifier autorisation
    if (req.user.role === "proprietaire") {
      const resident = await User.findOne({
        _id: residentId,
        idProprietaire: req.user._id,
        role: "resident",
      });
      if (!resident)
        return res.status(404).json({ message: "Résident non trouvé" });
    } else if (residentId !== req.user._id.toString()) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    // Requête
    const query = { residentId };
    if (annee) query.annee = parseInt(annee);
    if (mois) query.mois = parseInt(mois);

    const consommations = await Consommation.find(query)
      .populate("maisonId", "nomMaison")
      .sort({ annee: -1, mois: -1 });

    // Stats
    const totalKwh = consommations.reduce((s, c) => s + c.kwh, 0);
    const totalMontant = consommations.reduce((s, c) => s + c.montant, 0);
    const moyenneKwh =
      consommations.length > 0 ? totalKwh / consommations.length : 0;

    res.json({
      consommations,
      statistiques: {
        totalKwh,
        totalMontant,
        moyenneKwh,
        nombreReleves: consommations.length,
      },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des consommations:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des consommations" });
  }
};

// Obtenir les consommations d'une maison
const getConsommationsByMaison = async (req, res) => {
  try {
    const { maisonId } = req.params;
    const { annee, mois } = req.query;

    // Vérifier maison accessible
    let maison;
    if (req.user.role === "proprietaire") {
      maison = await Maison.findOne({
        _id: maisonId,
        proprietaireId: req.user._id,
      });
    } else {
      maison = await Maison.findOne({
        _id: maisonId,
        listeResidents: req.user._id,
      });
    }
    if (!maison) return res.status(404).json({ message: "Maison non trouvée" });

    // Requête
    const query = { maisonId };
    if (annee) query.annee = parseInt(annee);
    if (mois) query.mois = parseInt(mois);

    const consommations = await Consommation.find(query)
      .populate("residentId", "nom prenom email")
      .sort({ annee: -1, mois: -1, "residentId.nom": 1 });

    // Stats par résident
    const statsParResident = {};
    consommations.forEach((conso) => {
      const rId = conso.residentId._id.toString();
      if (!statsParResident[rId]) {
        statsParResident[rId] = {
          resident: conso.residentId,
          totalKwh: 0,
          totalMontant: 0,
          nombreReleves: 0,
        };
      }
      statsParResident[rId].totalKwh += conso.kwh;
      statsParResident[rId].totalMontant += conso.montant;
      statsParResident[rId].nombreReleves += 1;
    });

    res.json({
      consommations,
      statistiquesParResident: Object.values(statsParResident),
      maison: { _id: maison._id, nomMaison: maison.nomMaison },
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des consommations:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des consommations" });
  }
};

// Mettre à jour une consommation
const updateConsommation = async (req, res) => {
  try {
    const { id } = req.params;
    const { previousIndex, currentIndex, commentaire } = req.body;

    const consommation = await Consommation.findById(id);
    if (!consommation)
      return res.status(404).json({ message: "Consommation non trouvée" });

    // Vérifier autorisation
    if (req.user.role === "proprietaire") {
      const resident = await User.findOne({
        _id: consommation.residentId,
        idProprietaire: req.user._id,
        role: "resident",
      });
      if (!resident)
        return res.status(403).json({ message: "Accès non autorisé" });
    } else if (consommation.residentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    // Maj des valeurs
    if (previousIndex !== undefined) consommation.previousIndex = previousIndex;
    if (currentIndex !== undefined) consommation.currentIndex = currentIndex;
    if (commentaire !== undefined) consommation.commentaire = commentaire;

    await consommation.save();

    res.json({
      message: "Consommation mise à jour avec succès",
      consommation,
    });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la consommation:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour de la consommation" });
  }
};

// Supprimer une consommation
const deleteConsommation = async (req, res) => {
  try {
    const { id } = req.params;
    const consommation = await Consommation.findById(id);
    if (!consommation)
      return res.status(404).json({ message: "Consommation non trouvée" });

    // Seul le propriétaire peut supprimer
    if (req.user.role !== "proprietaire")
      return res.status(403).json({ message: "Accès non autorisé" });

    const resident = await User.findOne({
      _id: consommation.residentId,
      idProprietaire: req.user._id,
      role: "resident",
    });
    if (!resident)
      return res.status(403).json({ message: "Accès non autorisé" });

    if (consommation.statut === "facturee") {
      return res
        .status(400)
        .json({ message: "Impossible de supprimer une consommation facturée" });
    }

    await Consommation.findByIdAndDelete(id);
    res.json({ message: "Consommation supprimée avec succès" });
  } catch (error) {
    console.error("Erreur lors de la suppression de la consommation:", error);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression de la consommation" });
  }
};

module.exports = {
  addConsommation,
  getConsommationsByResident,
  getConsommationsByMaison,
  updateConsommation,
  deleteConsommation,
};
