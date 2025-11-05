// Handler serverless pour Vercel
const app = require('../app');

// Initialiser MongoDB au démarrage de la fonction serverless
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Si déjà connecté, réutiliser la connexion
    if (mongoose.connection.readyState === 1) {
      console.log('✅ [MongoDB] Connexion existante réutilisée');
      return mongoose.connection;
    }

    // Si une connexion est en cours, attendre
    if (mongoose.connection.readyState === 2) {
      console.log('⏳ [MongoDB] Connexion en cours, attente...');
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', resolve);
      });
      if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
      }
    }

    // Nouvelle connexion
    mongoose.set('strictQuery', false);
    
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGO_URI, options);
    console.log('✅ [MongoDB] Connexion établie');
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ [MongoDB] Erreur de connexion:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ [MongoDB] Déconnecté');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('💥 [MongoDB] Erreur lors de la connexion:', error);
    throw error;
  }
};

// Tenter de se connecter à MongoDB (mais ne pas bloquer si ça échoue)
connectDB().catch((error) => {
  console.error('💥 [Vercel] Erreur lors de la connexion MongoDB initiale:', error);
});

// Export handler pour Vercel
module.exports = app;

