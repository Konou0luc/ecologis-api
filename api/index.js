// Handler serverless pour Vercel
// Wrapper robuste pour gérer les erreurs
let app;

try {
  // S'assurer que VERCEL est défini avant de charger l'app
  if (!process.env.VERCEL) {
    process.env.VERCEL = '1';
  }
  
  app = require('../app');
  console.log('✅ [Vercel] App Express chargée avec succès');
} catch (error) {
  console.error('💥 [Vercel] Erreur lors du chargement de l\'app:', error);
  console.error('💥 [Vercel] Stack:', error.stack);
  
  // Créer une app minimale en cas d'erreur
  const express = require('express');
  app = express();
  app.use(express.json());
  
  app.use((req, res) => {
    res.status(500).json({ 
      message: 'Erreur lors de l\'initialisation du serveur',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  });
}

// Export handler pour Vercel
// Vercel attend une fonction (req, res) => {}
module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error('💥 [Vercel] Erreur dans le handler:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Erreur interne du serveur',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
};

