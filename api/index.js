// Handler serverless pour Vercel
// Wrapper l'app Express dans un handler serverless
let app;

try {
  app = require('../app');
} catch (error) {
  console.error('💥 [Vercel] Erreur lors du chargement de l\'app:', error);
  // Créer une app minimale en cas d'erreur
  const express = require('express');
  app = express();
  app.use((req, res) => {
    res.status(500).json({ 
      message: 'Erreur lors de l\'initialisation du serveur',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  });
}

// Handler pour Vercel serverless functions
// Vercel attend un export de fonction (req, res) => {}
module.exports = (req, res) => {
  try {
    return app(req, res);
  } catch (error) {
    console.error('💥 [Vercel] Erreur dans le handler:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Erreur interne du serveur',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

