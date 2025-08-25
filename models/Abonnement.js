const mongoose = require('mongoose');

const abonnementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['basic', 'premium', 'enterprise'],
    required: true
  },
  prix: {
    type: Number,
    required: true,
    min: 0
  },
  nbResidentsMax: {
    type: Number,
    required: true,
    min: 1
  },
  dateDebut: {
    type: Date,
    required: true,
    default: Date.now
  },
  dateFin: {
    type: Date,
    required: true
  },
  statut: {
    type: String,
    enum: ['actif', 'expiré', 'suspendu'],
    default: 'actif'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  proprietaireId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Méthode pour vérifier si l'abonnement est actif
abonnementSchema.methods.isActif = function() {
  return this.statut === 'actif' && this.dateFin > new Date();
};

// Méthode pour calculer les jours restants
abonnementSchema.methods.joursRestants = function() {
  const maintenant = new Date();
  const diffTime = this.dateFin - maintenant;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

// Méthode pour renouveler l'abonnement
abonnementSchema.methods.renouveler = function() {
  const nouvelleDateFin = new Date(this.dateFin);
  nouvelleDateFin.setMonth(nouvelleDateFin.getMonth() + 1);
  this.dateFin = nouvelleDateFin;
  this.statut = 'actif';
  return this.save();
};

// Index pour optimiser les requêtes
abonnementSchema.index({ proprietaireId: 1, statut: 1 });
abonnementSchema.index({ dateFin: 1, statut: 1 });

module.exports = mongoose.model('Abonnement', abonnementSchema);
