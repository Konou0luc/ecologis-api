// Handler serverless pour Vercel
process.env.VERCEL = '1';

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

// Configuration CORS - TOUJOURS ACTIVE
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Gérer les requêtes OPTIONS (preflight) - CRITIQUE pour CORS
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type', 'Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration MongoDB AVANT les routes
mongoose.set('strictQuery', false);
// Augmenter le buffer timeout pour éviter les timeouts
mongoose.set('bufferCommands', true);
mongoose.set('bufferMaxEntries', 0);

// Fonction de connexion MongoDB optimisée
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('❌ MONGO_URI non défini');
      throw new Error('MONGO_URI not set');
    }

    // Si déjà connecté, réutiliser
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB déjà connecté');
      return mongoose.connection;
    }

    // Si connexion en cours, attendre
    if (mongoose.connection.readyState === 2) {
      console.log('⏳ Connexion MongoDB en cours...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout attente connexion')), 10000);
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          resolve();
        });
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      return mongoose.connection;
    }

    // Nouvelle connexion
    console.log('🔄 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // Augmenté à 10s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
      bufferMaxEntries: 0,
      bufferCommands: false, // Désactiver le buffer pour forcer la connexion immédiate
    });
    console.log('✅ MongoDB connecté avec succès');
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB déconnecté');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('💥 Erreur connexion MongoDB:', error.message);
    throw error;
  }
};

// Middleware MongoDB - PLACÉ AVANT LES ROUTES
app.use(async (req, res, next) => {
  // Laisser passer les routes qui n'ont pas besoin de MongoDB
  if (req.path === '/' || req.path === '/config') {
    return next();
  }
  
  try {
    // S'assurer que MongoDB est connecté
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('💥 [MIDDLEWARE] Erreur MongoDB:', error.message);
    res.status(503).json({ 
      message: 'Base de données non accessible',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporairement indisponible'
    });
  }
});

// Route principale - TOUJOURS FONCTIONNELLE
app.get('/', (req, res) => {
  res.json({
    message: '✅ API Ecopower - Gestion de consommation électrique',
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    platform: 'Vercel Serverless',
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    }
  });
});

// Route config
app.get('/config', (req, res) => {
  res.json({ freeMode: process.env.FREE_MODE === 'true' });
});

// Charger les routes une par une pour identifier les problèmes
try {
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

// Gestion d'erreurs
app.use((err, req, res, next) => {
  console.error('💥 Erreur:', err);
  res.status(500).json({ 
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

module.exports = app;
