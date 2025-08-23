const Consommation = require('../models/Consommation');
const User = require('../models/User');
const Maison = require('../models/Maison');
const notifications = require('../utils/notifications');

// Enregistrer une consommation
const addConsommation = async (req, res) => {
  try {
    const { residentId, maisonId } = req.body;
    // préserver les décimales: ne jamais arrondir
    const kwh = req.body.kwh !== undefined ? Number(req.body.kwh) : undefined;
    const mois = req.body.mois !== undefined ? Number(req.body.mois) : undefined;
    const annee = req.body.annee !== undefined ? Number(req.body.annee) : undefined;
    const commentaire = req.body.commentaire;

    // Vérifier que l'utilisateur est autorisé
    if (req.user.role === 'proprietaire') {
      // Le propriétaire enregistre pour un de ses résidents
      const resident = await User.findOne({
        _id: residentId,
        idProprietaire: req.user._id,
        role: 'resident'
      });

      if (!resident) {
        return res.status(404).json({ message: 'Résident non trouvé' });
      }

      // Vérifier que la maison appartient au propriétaire
      const maison = await Maison.findOne({
        _id: maisonId,
        proprietaireId: req.user._id
      });

      if (!maison) {
        return res.status(404).json({ message: 'Maison non trouvée' });
      }
    } else {
      // Le résident enregistre sa propre consommation
      if (residentId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Vous ne pouvez enregistrer que votre propre consommation' });
      }

      // Vérifier que la maison est associée au résident
      const maison = await Maison.findOne({
        _id: maisonId,
        listeResidents: req.user._id
      });

      if (!maison) {
        return res.status(404).json({ message: 'Maison non trouvée' });
      }
    }

    // Vérifier si une consommation existe déjà pour cette période
    const existingConsommation = await Consommation.findOne({
      residentId,
      maisonId,
      mois,
      annee
    });

    if (existingConsommation) {
      return res.status(400).json({ 
        message: 'Une consommation existe déjà pour cette période',
        existingConsommation
      });
    }

    // Créer la consommation
    const consommation = new Consommation({
      residentId,
      maisonId,
      kwh: kwh, // conserver float
      mois: mois,
      annee: annee,
      commentaire
    });

    await consommation.save();

    // Récupérer le tarif de la maison et calculer le montant
    const maisonForTarif = await Maison.findById(maisonId);
    const tarif = maisonForTarif && typeof maisonForTarif.tarifKwh === 'number' ? maisonForTarif.tarifKwh : 0.1740;
    const montant = consommation.kwh * tarif;

    // Récupérer les 3 dernières consommations précédentes du résident (hors la nouvelle)
    const troisDernieres = await Consommation.find({
      residentId,
      _id: { $ne: consommation._id }
    })
      .sort({ annee: -1, mois: -1, createdAt: -1 })
      .limit(3);

    if (troisDernieres.length > 0) {
      const moyenne = troisDernieres.reduce((sum, c) => sum + c.kwh, 0) / troisDernieres.length;
      if (typeof kwh === 'number' && kwh > moyenne) {
        const message = `Attention ! Votre consommation de ${kwh} kWh dépasse votre moyenne habituelle de ${moyenne} kWh. Préparez-vous à une facture plus élevée.`;
        // Envoi de notification au résident
        await notifications.envoyer(residentId, message);
      }
    }

    res.status(201).json({
      message: 'Consommation enregistrée avec succès',
      consommation: {
        ...consommation.toObject(),
        montant
      }
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la consommation:', error);
    res.status(500).json({ message: 'Erreur lors de l\'enregistrement de la consommation' });
  }
};

// Obtenir l'historique des consommations d'un résident
const getConsommationsByResident = async (req, res) => {
  try {
    const { residentId } = req.params;
    const { annee, mois } = req.query;

    // Vérifier les autorisations
    if (req.user.role === 'proprietaire') {
      // Le propriétaire peut voir les consommations de ses résidents
      const resident = await User.findOne({
        _id: residentId,
        idProprietaire: req.user._id,
        role: 'resident'
      });

      if (!resident) {
        return res.status(404).json({ message: 'Résident non trouvé' });
      }
    } else {
      // Le résident ne peut voir que ses propres consommations
      if (residentId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }
    }

    // Construire la requête
    const query = { residentId };
    if (annee) query.annee = parseInt(annee);
    if (mois) query.mois = parseInt(mois);

    const consommations = await Consommation.find(query)
      .populate('maisonId', 'nomMaison')
      .sort({ annee: -1, mois: -1 });

    // Calculer les montants et les statistiques
    const consommationsWithAmounts = await Promise.all(consommations.map(async (conso) => {
      const maisonDoc = await Maison.findById(conso.maisonId);
      const t = maisonDoc && typeof maisonDoc.tarifKwh === 'number' ? maisonDoc.tarifKwh : 0.1740;
      return { ...conso.toObject(), montant: conso.kwh * t };
    }));

    // Calculer les statistiques
    const totalKwh = consommations.reduce((sum, conso) => sum + conso.kwh, 0);
    const totalMontant = consommationsWithAmounts.reduce((sum, conso) => sum + conso.montant, 0);
    const moyenneKwh = consommations.length > 0 ? totalKwh / consommations.length : 0;

    res.json({
      consommations: consommationsWithAmounts,
      statistiques: {
        totalKwh,
        totalMontant,
        moyenneKwh,
        nombreReleves: consommations.length
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des consommations:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des consommations' });
  }
};

// Obtenir les consommations d'une maison
const getConsommationsByMaison = async (req, res) => {
  try {
    const { maisonId } = req.params;
    const { annee, mois } = req.query;

    // Vérifier que l'utilisateur a accès à cette maison
    let maison;
    if (req.user.role === 'proprietaire') {
      maison = await Maison.findOne({
        _id: maisonId,
        proprietaireId: req.user._id
      });
    } else {
      maison = await Maison.findOne({
        _id: maisonId,
        listeResidents: req.user._id
      });
    }

    if (!maison) {
      return res.status(404).json({ message: 'Maison non trouvée' });
    }

    // Construire la requête
    const query = { maisonId };
    if (annee) query.annee = parseInt(annee);
    if (mois) query.mois = parseInt(mois);

    const consommations = await Consommation.find(query)
      .populate('residentId', 'nom prenom email')
      .sort({ annee: -1, mois: -1, 'residentId.nom': 1 });

    // Calculer les montants
    const consommationsWithAmounts = await Promise.all(consommations.map(async (conso) => {
      const maisonDoc = await Maison.findById(conso.maisonId);
      const t = maisonDoc && typeof maisonDoc.tarifKwh === 'number' ? maisonDoc.tarifKwh : 0.1740;
      return { ...conso.toObject(), montant: conso.kwh * t };
    }));

    // Calculer les statistiques par résident
    const statsParResident = {};
    consommations.forEach(conso => {
      const residentId = conso.residentId._id.toString();
      if (!statsParResident[residentId]) {
        statsParResident[residentId] = {
          resident: conso.residentId,
          totalKwh: 0,
          totalMontant: 0,
          nombreReleves: 0
        };
      }
      const montantConso = consommationsWithAmounts.find(c => c._id.toString() === conso._id.toString())?.montant || 0;
      statsParResident[residentId].totalKwh += conso.kwh;
      statsParResident[residentId].totalMontant += montantConso;
      statsParResident[residentId].nombreReleves += 1;
    });

    res.json({
      consommations: consommationsWithAmounts,
      statistiquesParResident: Object.values(statsParResident),
      maison: {
        _id: maison._id,
        nomMaison: maison.nomMaison
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des consommations:', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des consommations' });
  }
};

// Mettre à jour une consommation
const updateConsommation = async (req, res) => {
  try {
    const { id } = req.params;
    const { kwh, commentaire } = req.body;

    // Trouver la consommation
    const consommation = await Consommation.findById(id);
    if (!consommation) {
      return res.status(404).json({ message: 'Consommation non trouvée' });
    }

    // Vérifier les autorisations
    if (req.user.role === 'proprietaire') {
      const resident = await User.findOne({
        _id: consommation.residentId,
        idProprietaire: req.user._id,
        role: 'resident'
      });

      if (!resident) {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }
    } else {
      if (consommation.residentId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Accès non autorisé' });
      }
    }

    // Mettre à jour
    if (kwh !== undefined) consommation.kwh = kwh;
    if (commentaire !== undefined) consommation.commentaire = commentaire;

    await consommation.save();

    res.json({
      message: 'Consommation mise à jour avec succès',
      consommation: {
        ...consommation.toObject(),
        montant: consommation.calculerMontant()
      }
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la consommation:', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la consommation' });
  }
};

// Supprimer une consommation
const deleteConsommation = async (req, res) => {
  try {
    const { id } = req.params;

    // Trouver la consommation
    const consommation = await Consommation.findById(id);
    if (!consommation) {
      return res.status(404).json({ message: 'Consommation non trouvée' });
    }

    // Vérifier les autorisations (seul le propriétaire peut supprimer)
    if (req.user.role !== 'proprietaire') {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    const resident = await User.findOne({
      _id: consommation.residentId,
      idProprietaire: req.user._id,
      role: 'resident'
    });

    if (!resident) {
      return res.status(403).json({ message: 'Accès non autorisé' });
    }

    // Vérifier que la consommation n'est pas facturée
    if (consommation.statut === 'facturee') {
      return res.status(400).json({ message: 'Impossible de supprimer une consommation facturée' });
    }

    await Consommation.findByIdAndDelete(id);

    res.json({ message: 'Consommation supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la consommation:', error);
    res.status(500).json({ message: 'Erreur lors de la suppression de la consommation' });
  }
};

module.exports = {
  addConsommation,
  getConsommationsByResident,
  getConsommationsByMaison,
  updateConsommation,
  deleteConsommation
};
