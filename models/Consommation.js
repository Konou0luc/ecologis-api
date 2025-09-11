const mongoose = require('mongoose');
const Maison = require('./Maison.js')

const consommationSchema = new mongoose.Schema({
  residentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  maisonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Maison',
    required: true
  },
  previousIndex: {
    type: Number,
    required: true,
    min: 0
  },
  currentIndex: {
    type: Number,
    required: true,
    min: 0
  },
  kwh: {
    type: Number,
    required: true,
    min: 0
  },
  montant: {
    type: Number,
    required: true,
    min: 0
  },
  mois: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  annee: {
    type: Number,
    required: true,
    min: 2025
  },
  dateReleve: {
    type: Date,
    default: Date.now
  },
  commentaire: {
    type: String,
    trim: true
  },
  statut: {
    type: String,
    enum: ['enregistree', 'facturee'],
    default: 'enregistree'
  }
}, {
  timestamps: true
});

consommationSchema.pre("save", async function (next) {
  console.log("📥 Pre-save consommation:", this);

  this.kwh = this.currentIndex - this.previousIndex;

  if (this.kwh < 0) {
    return next(new Error("L'index actuel doit être ≥ à l'ancien index"));
  }

  const maison = await Maison.findById(this.maisonId);
  if (!maison) {
    console.error("❌ Maison introuvable avec id:", this.maisonId);
    return next(new Error("Aucun maison trouvé avec cet id"));
  }

  this.montant = this.kwh * maison.tarifKwh;
  console.log("✅ kwh et montant calculés:", this.kwh, this.montant);

  next();
});

// Méthode pour obtenir la période (mois/année)
consommationSchema.virtual('periode').get(function() {
  const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return `${mois[this.mois - 1]} ${this.annee}`;
});

// Configuration pour inclure les virtuals dans les réponses JSON
consommationSchema.set('toJSON', {
  virtuals: true
});

// Index composé pour éviter les doublons
consommationSchema.index({ 
  residentId: 1, 
  maisonId: 1, 
  mois: 1, 
  annee: 1 
}, { unique: true });

// Index pour optimiser les requêtes
consommationSchema.index({ residentId: 1, annee: 1, mois: 1 });
consommationSchema.index({ maisonId: 1, annee: 1, mois: 1 });

module.exports = mongoose.model('Consommation', consommationSchema);
