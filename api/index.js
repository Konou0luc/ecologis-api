// Handler serverless pour Vercel
process.env.VERCEL = '1';

const express = require('express');
const cors = require('cors');
const app = express();

// Configuration CORS - TOUJOURS ACTIVE
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Gérer les requêtes OPTIONS (preflight) - CRITIQUE pour CORS
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Route principale - TOUJOURS FONCTIONNELLE
app.get('/', (req, res) => {
  res.json({
    message: '✅ API Ecopower - Gestion de consommation électrique',
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'Vercel Serverless'
  });
});

// Route config
app.get('/config', (req, res) => {
  res.json({ freeMode: process.env.FREE_MODE === 'true' });
});

// Charger les routes une par une pour identifier les problèmes
try {
  // Route auth - CRITIQUE pour le login
  const authRoutes = require('../routes/auth');
  app.use('/auth', authRoutes);
  console.log('✅ Route /auth chargée');
} catch (error) {
  console.error('❌ Erreur route /auth:', error.message);
  app.post('/auth/login', (req, res) => {
    res.status(500).json({ message: 'Route auth non disponible', error: error.message });
  });
}

try {
  const residentsRoutes = require('../routes/residents');
  app.use('/residents', residentsRoutes);
  console.log('✅ Route /residents chargée');
} catch (error) {
  console.error('❌ Erreur route /residents:', error.message);
}

try {
  const consommationsRoutes = require('../routes/consommations');
  app.use('/consommations', consommationsRoutes);
  console.log('✅ Route /consommations chargée');
} catch (error) {
  console.error('❌ Erreur route /consommations:', error.message);
}

try {
  const facturesRoutes = require('../routes/factures');
  app.use('/factures', facturesRoutes);
  console.log('✅ Route /factures chargée');
} catch (error) {
  console.error('❌ Erreur route /factures:', error.message);
}

try {
  const abonnementsRoutes = require('../routes/abonnements');
  app.use('/abonnements', abonnementsRoutes);
  console.log('✅ Route /abonnements chargée');
} catch (error) {
  console.error('❌ Erreur route /abonnements:', error.message);
}

try {
  const maisonsRoutes = require('../routes/maisons');
  app.use('/maisons', maisonsRoutes);
  console.log('✅ Route /maisons chargée');
} catch (error) {
  console.error('❌ Erreur route /maisons:', error.message);
}

try {
  const messagesRoutes = require('../routes/messages');
  app.use('/messages', messagesRoutes);
  console.log('✅ Route /messages chargée');
} catch (error) {
  console.error('❌ Erreur route /messages:', error.message);
}

try {
  const adminRoutes = require('../routes/admin');
  app.use('/admin', adminRoutes);
  console.log('✅ Route /admin chargée');
} catch (error) {
  console.error('❌ Erreur route /admin:', error.message);
}

// Middleware MongoDB - charger à la demande
const mongoose = require('mongoose');
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not set');
    }
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }
    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connecté');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Erreur MongoDB:', error.message);
    throw error;
  }
};

// Middleware pour MongoDB - seulement si nécessaire
app.use(async (req, res, next) => {
  if (req.path === '/' || req.path === '/config') {
    return next();
  }
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    res.status(503).json({ 
      message: 'Base de données non accessible',
      error: error.message 
    });
  }
});

// Gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('💥 Erreur:', err);
  res.status(500).json({ 
    message: 'Erreur interne du serveur',
    error: err.message 
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

module.exports = app;
