// Handler serverless pour Vercel
// S'assurer que VERCEL est défini avant tout
process.env.VERCEL = '1';

// Essayer de charger l'app principale
let app;

try {
  // Charger l'app principale
  app = require('../app');
  console.log('✅ [Vercel] App principale chargée avec succès');
} catch (error) {
  console.error('💥 [Vercel] Erreur lors du chargement de l\'app principale:', error.message);
  console.error('💥 [Vercel] Stack:', error.stack);
  
  // Créer une app minimale avec CORS en cas d'erreur
  const express = require('express');
  const cors = require('cors');
  
  app = express();
  
  // Configuration CORS complète
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
  }));
  
  // Gérer les requêtes OPTIONS (preflight)
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
  });
  
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Route principale
  app.get('/', (req, res) => {
    res.json({
      message: '✅ API Ecopower - Gestion de consommation électrique',
      status: 'online',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      error: error.message
    });
  });
  
  // Route de login avec CORS
  app.post('/auth/login', (req, res) => {
    res.status(500).json({
      message: 'Service temporairement indisponible',
      error: error.message
    });
  });
  
  // Toutes les autres routes
  app.use((req, res) => {
    res.status(500).json({
      message: 'Service temporairement indisponible',
      error: error.message
    });
  });
}

// Export pour Vercel
module.exports = app;
