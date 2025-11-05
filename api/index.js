// Handler serverless pour Vercel
process.env.VERCEL = '1';

const express = require('express');
const cors = require('cors');
const app = express();

// Configuration CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route principale
app.get('/', (req, res) => {
  res.json({
    message: '✅ API Ecopower - Gestion de consommation électrique',
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Charger l'app principale avec gestion d'erreur
let mainApp;
try {
  mainApp = require('../app');
  // Si l'app principale se charge, utiliser ses routes
  app.use(mainApp);
  console.log('✅ [Vercel] App principale chargée avec succès');
} catch (error) {
  console.error('💥 [Vercel] Erreur lors du chargement de l\'app principale:', error.message);
  console.error('💥 [Vercel] Stack:', error.stack);
  
  // Routes de fallback
  app.use('/auth/login', (req, res) => {
    res.status(500).json({
      message: 'Service temporairement indisponible',
      error: error.message
    });
  });
  
  app.use((req, res) => {
    res.status(500).json({
      message: 'Service temporairement indisponible',
      error: error.message
    });
  });
}

module.exports = app;

