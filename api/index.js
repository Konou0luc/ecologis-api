// Handler serverless pour Vercel
// S'assurer que VERCEL est défini avant tout
process.env.VERCEL = '1';

let app;
let appLoadError = null;

try {
  app = require('../app');
  console.log('✅ [Vercel] App Express chargée avec succès');
} catch (error) {
  appLoadError = error;
  console.error('💥 [Vercel] Erreur lors du chargement de l\'app:', error.message);
  console.error('💥 [Vercel] Stack:', error.stack);
  
  // Créer une app minimale en cas d'erreur avec CORS
  const express = require('express');
  const cors = require('cors');
  app = express();
  
  // Configuration CORS pour l'app minimale
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));
  
  // Gérer les requêtes OPTIONS (preflight)
  app.options('*', cors());
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Route de base pour vérifier que l'API fonctionne
  app.get('/', (req, res) => {
    res.json({
      message: '✅ API Ecopower - En ligne',
      status: 'online',
      error: appLoadError ? appLoadError.message : undefined,
      timestamp: new Date().toISOString()
    });
  });
  
  // Toutes les autres routes retournent une erreur
  app.use((req, res) => {
    res.status(500).json({ 
      message: 'Erreur lors de l\'initialisation du serveur',
      error: appLoadError.message,
      stack: process.env.NODE_ENV === 'development' ? appLoadError.stack : undefined
    });
  });
}

// Export handler pour Vercel
// Vercel détecte automatiquement les apps Express et les traite correctement
module.exports = app;

