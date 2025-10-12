const mongoose = require('mongoose');
require('dotenv').config();

// Modèle Abonnement
const abonnementSchema = new mongoose.Schema({
  type: { type: String, required: true },
  prix: { type: Number, required: true },
  nbResidentsMax: { type: Number, required: true },
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date, required: true },
  statut: { type: String, enum: ['actif', 'expiré', 'suspendu'], default: 'actif' },
  isActive: { type: Boolean, default: true },
  proprietaireId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
});

const Abonnement = mongoose.model('Abonnement', abonnementSchema);

async function fixSubscription() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connecté à MongoDB');

    // Trouver l'abonnement problématique
    const abonnement = await Abonnement.findById('68bf4e8a8473daa5a0fe8326');
    
    if (!abonnement) {
      console.log('❌ Abonnement non trouvé');
      return;
    }

    console.log('📅 Abonnement actuel:', {
      id: abonnement._id,
      type: abonnement.type,
      dateDebut: abonnement.dateDebut,
      dateFin: abonnement.dateFin,
      statut: abonnement.statut,
      isActive: abonnement.isActive
    });

    // Corriger les dates pour un abonnement d'1 mois
    const dateDebut = new Date('2025-09-08T21:45:46.499Z');
    const dateFin = new Date('2025-10-08T21:45:46.499Z'); // 1 mois après

    abonnement.dateDebut = dateDebut;
    abonnement.dateFin = dateFin;
    
    // Vérifier si l'abonnement est expiré
    const maintenant = new Date();
    if (dateFin <= maintenant) {
      abonnement.statut = 'expiré';
      abonnement.isActive = false;
      console.log('⚠️ Abonnement marqué comme expiré');
    } else {
      abonnement.statut = 'actif';
      abonnement.isActive = true;
      console.log('✅ Abonnement marqué comme actif');
    }

    await abonnement.save();

    console.log('✅ Abonnement corrigé:', {
      id: abonnement._id,
      type: abonnement.type,
      dateDebut: abonnement.dateDebut,
      dateFin: abonnement.dateFin,
      statut: abonnement.statut,
      isActive: abonnement.isActive,
      joursRestants: Math.ceil((abonnement.dateFin - maintenant) / (1000 * 60 * 60 * 24))
    });

  } catch (error) {
    console.error('💥 Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

fixSubscription();
