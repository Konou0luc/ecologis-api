const cron = require('node-cron');
const Abonnement = require('../models/Abonnement');
const Facture = require('../models/Facture');
const { notifySubscriptionExpiry, notifyOverdueInvoices } = require('./notifications');

// Vérifier et marquer les abonnements expirés
const checkExpiredSubscriptions = async () => {
  try {
    console.log('🕐 Vérification des abonnements expirés...');
    
    const abonnementsExpires = await Abonnement.find({
      dateFin: { $lt: new Date() },
      statut: 'actif'
    });

    for (const abonnement of abonnementsExpires) {
      abonnement.statut = 'expiré';
      await abonnement.save();
      console.log(`❌ Abonnement expiré: ${abonnement._id} (${abonnement.type})`);
    }

    console.log(`✅ ${abonnementsExpires.length} abonnements marqués comme expirés`);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des abonnements expirés:', error);
  }
};

// Vérifier et marquer les factures en retard
const checkOverdueInvoices = async () => {
  try {
    console.log('🕐 Vérification des factures en retard...');
    
    const facturesEnRetard = await Facture.find({
      dateEcheance: { $lt: new Date() },
      statut: 'non payée'
    });

    for (const facture of facturesEnRetard) {
      facture.statut = 'en retard';
      await facture.save();
      console.log(`⚠️ Facture en retard: ${facture.numeroFacture}`);
    }

    console.log(`✅ ${facturesEnRetard.length} factures marquées comme en retard`);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des factures en retard:', error);
  }
};

// Nettoyer les anciens messages (plus de 6 mois)
const cleanupOldMessages = async () => {
  try {
    console.log('🕐 Nettoyage des anciens messages...');
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const Message = require('../models/Message');
    const result = await Message.deleteMany({
      dateEnvoi: { $lt: sixMonthsAgo },
      type: { $in: ['text', 'system'] } // Garder les messages de facture
    });

    console.log(`✅ ${result.deletedCount} anciens messages supprimés`);
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des messages:', error);
  }
};

// Générer des statistiques quotidiennes
const generateDailyStats = async () => {
  try {
    console.log('🕐 Génération des statistiques quotidiennes...');
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Statistiques des consommations
    const Consommation = require('../models/Consommation');
    const consommationsHier = await Consommation.countDocuments({
      createdAt: {
        $gte: yesterday,
        $lt: today
      }
    });
    
    // Statistiques des factures
    const facturesHier = await Facture.countDocuments({
      dateEmission: {
        $gte: yesterday,
        $lt: today
      }
    });
    
    // Statistiques des paiements
    const paiementsHier = await Facture.countDocuments({
      datePaiement: {
        $gte: yesterday,
        $lt: today
      },
      statut: 'payée'
    });
    
    console.log(`📊 Statistiques du ${yesterday.toLocaleDateString()}:`);
    console.log(`   - Consommations enregistrées: ${consommationsHier}`);
    console.log(`   - Factures générées: ${facturesHier}`);
    console.log(`   - Paiements reçus: ${paiementsHier}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération des statistiques:', error);
  }
};

// Vérifier la santé de la base de données
const checkDatabaseHealth = async () => {
  try {
    console.log('🕐 Vérification de la santé de la base de données...');
    
    // Vérifier les connexions
    const mongoose = require('mongoose');
    const dbState = mongoose.connection.readyState;
    
    const states = {
      0: 'déconnecté',
      1: 'connecté',
      2: 'connexion en cours',
      3: 'déconnexion en cours'
    };
    
    console.log(`📊 État de la base de données: ${states[dbState]}`);
    
    // Compter les documents
    const User = require('../models/User');
    const Abonnement = require('../models/Abonnement');
    const Facture = require('../models/Facture');
    const Consommation = require('../models/Consommation');
    
    const stats = {
      users: await User.countDocuments(),
      abonnements: await Abonnement.countDocuments(),
      factures: await Facture.countDocuments(),
      consommations: await Consommation.countDocuments()
    };
    
    console.log('📊 Statistiques de la base de données:');
    console.log(`   - Utilisateurs: ${stats.users}`);
    console.log(`   - Abonnements: ${stats.abonnements}`);
    console.log(`   - Factures: ${stats.factures}`);
    console.log(`   - Consommations: ${stats.consommations}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la santé de la DB:', error);
  }
};

// Initialiser les tâches cron
const initCronJobs = () => {
  console.log('🚀 Initialisation des tâches cron...');
  
  // Vérifier les abonnements expirés tous les jours à 2h00
  cron.schedule('0 2 * * *', checkExpiredSubscriptions, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  // Vérifier les factures en retard tous les jours à 3h00
  cron.schedule('0 3 * * *', checkOverdueInvoices, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  // Envoyer les notifications d'expiration d'abonnement tous les jours à 9h00
  cron.schedule('0 9 * * *', notifySubscriptionExpiry, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  // Envoyer les notifications de factures en retard tous les jours à 10h00
  cron.schedule('0 10 * * *', notifyOverdueInvoices, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  // Nettoyer les anciens messages tous les dimanches à 4h00
  cron.schedule('0 4 * * 0', cleanupOldMessages, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  // Générer les statistiques quotidiennes tous les jours à 6h00
  cron.schedule('0 6 * * *', generateDailyStats, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  // Vérifier la santé de la DB toutes les heures
  cron.schedule('0 * * * *', checkDatabaseHealth, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  console.log('✅ Tâches cron initialisées');
};

// Arrêter toutes les tâches cron
const stopCronJobs = () => {
  console.log('🛑 Arrêt des tâches cron...');
  cron.getTasks().forEach(task => task.stop());
  console.log('✅ Tâches cron arrêtées');
};

// Exécuter une tâche manuellement
const runTaskManually = async (taskName) => {
  console.log(`🔧 Exécution manuelle de la tâche: ${taskName}`);
  
  switch (taskName) {
    case 'checkExpiredSubscriptions':
      await checkExpiredSubscriptions();
      break;
    case 'checkOverdueInvoices':
      await checkOverdueInvoices();
      break;
    case 'notifySubscriptionExpiry':
      await notifySubscriptionExpiry();
      break;
    case 'notifyOverdueInvoices':
      await notifyOverdueInvoices();
      break;
    case 'cleanupOldMessages':
      await cleanupOldMessages();
      break;
    case 'generateDailyStats':
      await generateDailyStats();
      break;
    case 'checkDatabaseHealth':
      await checkDatabaseHealth();
      break;
    default:
      console.error(`❌ Tâche inconnue: ${taskName}`);
  }
};

module.exports = {
  initCronJobs,
  stopCronJobs,
  runTaskManually,
  checkExpiredSubscriptions,
  checkOverdueInvoices,
  cleanupOldMessages,
  generateDailyStats,
  checkDatabaseHealth
};
