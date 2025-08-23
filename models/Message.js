const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  maisonId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Maison',
    required: true
  },
  contenu: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['text', 'facture', 'system', 'notification'],
    default: 'text'
  },
  dateEnvoi: {
    type: Date,
    default: Date.now
  },
  lu: {
    type: Boolean,
    default: false
  },
  dateLecture: {
    type: Date,
    default: null
  },
  metadata: {
    factureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facture',
      default: null
    },
    consommationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consommation',
      default: null
    },
    montant: {
      type: Number,
      default: null
    }
  },
  statut: {
    type: String,
    enum: ['envoyé', 'livré', 'lu'],
    default: 'envoyé'
  }
}, {
  timestamps: true
});

// Méthode pour marquer comme lu
messageSchema.methods.marquerCommeLu = function() {
  this.lu = true;
  this.dateLecture = new Date();
  this.statut = 'lu';
  return this.save();
};

// Méthode pour marquer comme livré
messageSchema.methods.marquerCommeLivre = function() {
  this.statut = 'livré';
  return this.save();
};

// Méthode pour vérifier si c'est un message privé
messageSchema.virtual('isPrive').get(function() {
  return this.receiverId !== null;
});

// Méthode pour vérifier si c'est un message de groupe
messageSchema.virtual('isGroupe').get(function() {
  return this.receiverId === null;
});

// Configuration pour inclure les virtuals dans les réponses JSON
messageSchema.set('toJSON', {
  virtuals: true
});

// Index pour optimiser les requêtes
messageSchema.index({ senderId: 1, dateEnvoi: -1 });
messageSchema.index({ receiverId: 1, dateEnvoi: -1 });
messageSchema.index({ maisonId: 1, dateEnvoi: -1 });
messageSchema.index({ type: 1, dateEnvoi: -1 });
messageSchema.index({ lu: 1, receiverId: 1 });

module.exports = mongoose.model('Message', messageSchema);
