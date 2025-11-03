const User = require('../models/User');
const Abonnement = require('../models/Abonnement');
const Facture = require('../models/Facture');
const admin = require('../config/firebase');

// Envoyer une notification générique à un résident via FCM
const envoyer = async (residentId, message) => {
  try {
    const resident = await User.findById(residentId);
    if (!resident) {
      console.error('❌ Résident non trouvé pour notification');
      return { success: false, error: 'RESIDENT_NOT_FOUND' };
    }

    const deviceToken = resident.deviceToken;
    if (!deviceToken) {
      console.error('❌ deviceToken manquant pour le résident', resident._id.toString());
      return { success: false, error: 'DEVICE_TOKEN_MISSING' };
    }

    const payload = {
      notification: {
        title: 'Ecopower',
        body: message
      },
      data: {
        userId: resident._id.toString()
      }
    };

    const options = { priority: 'high' };

    console.log(`🔔 Envoi FCM à ${resident.nomComplet} (${resident._id})`);
    const response = await admin.messaging().sendToDevice(deviceToken, payload, options);
    console.log('✅ FCM envoyé:', JSON.stringify(response));
    return { success: true, response };
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi FCM:', error);
    return { success: false, error: error.message };
  }
};

// Notification d'expiration d'abonnement
const notifySubscriptionExpiry = async () => {
  try {
    console.log('🔔 Vérification des abonnements expirant bientôt...');
    
    // Trouver les abonnements qui expirent dans les 7 jours
    const dateLimite = new Date();
    dateLimite.setDate(dateLimite.getDate() + 7);
    
    const abonnementsExpirant = await Abonnement.find({
      dateFin: { $lte: dateLimite, $gt: new Date() },
      statut: 'actif'
    }).populate('proprietaireId');

    for (const abonnement of abonnementsExpirant) {
      const joursRestants = abonnement.joursRestants();
      
      if (joursRestants <= 7 && joursRestants > 0) {
        console.log(`⚠️ Abonnement expirant dans ${joursRestants} jours pour ${abonnement.proprietaireId.nomComplet}`);
        const message = `Votre abonnement expire dans ${joursRestants} jour(s). Pensez à le renouveler.`;
        try {
          await envoyer(abonnement.proprietaireId._id, message);
        } catch (e) {
          console.error('❌ Erreur envoi FCM (expiry):', e);
        }
      }
    }

    console.log(`✅ ${abonnementsExpirant.length} abonnements vérifiés`);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des abonnements:', error);
  }
};

// Notification de factures en retard
const notifyOverdueInvoices = async () => {
  try {
    console.log('🔔 Vérification des factures en retard...');
    
    // Trouver les factures en retard (plus de 30 jours)
    const dateLimite = new Date();
    dateLimite.setDate(dateLimite.getDate() - 30);
    
    const facturesEnRetard = await Facture.find({
      dateEcheance: { $lt: dateLimite },
      statut: 'non payée'
    }).populate('residentId');

    for (const facture of facturesEnRetard) {
      const joursRetard = facture.joursRetard();
      
      if (joursRetard > 30) {
        console.log(`⚠️ Facture en retard de ${joursRetard} jours pour ${facture.residentId.nomComplet}`);
        const message = `Rappel: votre facture ${facture.numeroFacture} (${facture.montant}) a ${joursRetard} jours de retard.`;
        try {
          await envoyer(facture.residentId._id, message);
        } catch (e) {
          console.error('❌ Erreur envoi FCM (overdue):', e);
        }
        
        // Marquer comme en retard si ce n'est pas déjà fait
        if (facture.statut === 'non payée') {
          facture.statut = 'en retard';
          await facture.save();
        }
      }
    }

    console.log(`✅ ${facturesEnRetard.length} factures vérifiées`);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des factures:', error);
  }
};

// Notification de nouvelle facture générée
const notifyNewInvoice = async (factureId) => {
  try {
    const facture = await Facture.findById(factureId)
      .populate('residentId')
      .populate('maisonId');

    if (!facture) {
      console.error('Facture non trouvée pour notification');
      return;
    }

    console.log(`📧 Notification de nouvelle facture pour ${facture.residentId.nomComplet}`);
    const message = `Nouvelle facture ${facture.numeroFacture}: montant ${facture.montant}. Échéance le ${new Date(facture.dateEcheance).toLocaleDateString()}.`;
    try {
      await envoyer(facture.residentId._id, message);
    } catch (e) {
      console.error('❌ Erreur envoi FCM (new invoice):', e);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la notification de nouvelle facture:', error);
  }
};

// Notification de paiement reçu
const notifyPaymentReceived = async (factureId) => {
  try {
    const facture = await Facture.findById(factureId)
      .populate('residentId')
      .populate('maisonId')
      .populate({
        path: 'maisonId',
        populate: { path: 'proprietaireId' }
      });

    if (!facture) {
      console.error('Facture non trouvée pour notification de paiement');
      return;
    }

    console.log(`💰 Notification de paiement reçu pour ${facture.residentId.nomComplet}`);
    console.log(`📧 Paiement reçu: ${facture.numeroFacture} - ${facture.montant}`);
    const message = `Paiement reçu pour ${facture.numeroFacture}. Merci !`;
    try {
      await envoyer(facture.residentId._id, message);
    } catch (e) {
      console.error('❌ Erreur envoi FCM (payment received):', e);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la notification de paiement:', error);
  }
};

// Notification de nouveau résident ajouté
const notifyNewResident = async (residentId, proprietaireId) => {
  try {
    const resident = await User.findById(residentId);
    const proprietaire = await User.findById(proprietaireId);

    if (!resident || !proprietaire) {
      console.error('Utilisateur non trouvé pour notification');
      return;
    }

    console.log(`👤 Nouveau résident ajouté: ${resident.nomComplet} par ${proprietaire.nomComplet}`);
    const message = `Nouveau résident ajouté: ${resident.nomComplet}`;
    try {
      await envoyer(proprietaire._id, message);
    } catch (e) {
      console.error('❌ Erreur envoi FCM (new resident):', e);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la notification de nouveau résident:', error);
  }
};

// Notification de consommation enregistrée
const notifyConsumptionRecorded = async (consommationId) => {
  try {
    const Consommation = require('../models/Consommation');
    const consommation = await Consommation.findById(consommationId)
      .populate('residentId')
      .populate('maisonId');

    if (!consommation) {
      console.error('Consommation non trouvée pour notification');
      return;
    }

    console.log(`⚡ Consommation enregistrée: ${consommation.kwh} kWh pour ${consommation.residentId.nomComplet}`);
    const message = `Nouvelle consommation enregistrée: ${consommation.kwh} kWh.`;
    try {
      await envoyer(consommation.residentId._id, message);
    } catch (e) {
      console.error('❌ Erreur envoi FCM (consumption):', e);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la notification de consommation:', error);
  }
};

// Notification de quota de résidents atteint
const notifyResidentQuotaReached = async (proprietaireId, quotaActuel, quotaMaximum) => {
  try {
    const proprietaire = await User.findById(proprietaireId);

    if (!proprietaire) {
      console.error('Propriétaire non trouvé pour notification de quota');
      return;
    }

    console.log(`⚠️ Quota de résidents atteint pour ${proprietaire.nomComplet}: ${quotaActuel}/${quotaMaximum}`);
    const message = `Quota de résidents atteint: ${quotaActuel}/${quotaMaximum}.`;
    try {
      await envoyer(proprietaire._id, message);
    } catch (e) {
      console.error('❌ Erreur envoi FCM (quota):', e);
    }

  } catch (error) {
    console.error('❌ Erreur lors de la notification de quota:', error);
  }
};

// Notification de maintenance système
const notifySystemMaintenance = async (message, users = null) => {
  try {
    console.log(`🔧 Notification de maintenance: ${message}`);

    if (users) {
      // Notification à des utilisateurs spécifiques
      for (const userId of users) {
        const user = await User.findById(userId);
        if (user) {
          console.log(`📧 Notification de maintenance envoyée à ${user.nomComplet}`);
          try {
            await envoyer(user._id, message);
          } catch (e) {
            console.error('❌ Erreur envoi FCM (maintenance user):', e);
          }
        }
      }
    } else {
      // Notification à tous les utilisateurs actifs
      const activeUsers = await User.find({ statut: 'active' });
      console.log(`📧 Notification de maintenance envoyée à ${activeUsers.length} utilisateurs`);
      for (const user of activeUsers) {
        try {
          await envoyer(user._id, message);
        } catch (e) {
          console.error('❌ Erreur envoi FCM (maintenance broadcast):', e);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de la notification de maintenance:', error);
  }
};

module.exports = {
  notifySubscriptionExpiry,
  notifyOverdueInvoices,
  notifyNewInvoice,
  notifyPaymentReceived,
  notifyNewResident,
  notifyConsumptionRecorded,
  notifyResidentQuotaReached,
  notifySystemMaintenance,
  envoyer
};
