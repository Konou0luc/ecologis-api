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
  
  // Créer une app minimale en cas d'erreur
  const express = require('express');
  app = express();
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

// Handler pour Vercel serverless functions
module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error('💥 [Vercel] Erreur dans le handler:', error);
    console.error('💥 [Vercel] Stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Erreur interne du serveur',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

