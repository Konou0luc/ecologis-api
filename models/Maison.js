const mongoose = require('mongoose');

const maisonSchema = new mongoose.Schema({
  nomMaison: {
    type: String,
    required: true,
    trim: true
  },
  proprietaireId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  listeResidents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  adresse: {
    rue: String,
    ville: String,
    codePostal: String,
    pays: {
      type: String,
      default: 'Togo'
    }
  },
  description: {
    type: String,
    trim: true
  },
  tarifKwh: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  statut: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Méthode pour ajouter un résident
maisonSchema.methods.ajouterResident = function(residentId) {
  if (!this.listeResidents.includes(residentId)) {
    this.listeResidents.push(residentId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Méthode pour retirer un résident
maisonSchema.methods.retirerResident = function(residentId) {
  this.listeResidents = this.listeResidents.filter(id => !id.equals(residentId));
  return this.save();
};

// Méthode pour obtenir le nombre de résidents
maisonSchema.virtual('nbResidents').get(function() {
  return this.listeResidents.length;
});

// Configuration pour inclure les virtuals dans les réponses JSON
maisonSchema.set('toJSON', {
  virtuals: true
});

// Index pour optimiser les requêtes
maisonSchema.index({ proprietaireId: 1 });
maisonSchema.index({ listeResidents: 1 });

module.exports = mongoose.model('Maison', maisonSchema);
