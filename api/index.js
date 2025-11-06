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
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type', 'Authorization', 'X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration MongoDB (lazy loading)
let mongoose = null;
let mongoConnected = false;
let mongoConnectionAttempts = 0;

const initMongoDB = () => {
  if (mongoose) return mongoose;
  
  try {
    mongoose = require('mongoose');
    mongoose.set('strictQuery', false);
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferMaxEntries', 0);
    return mongoose;
  } catch (error) {
    console.error('❌ Erreur chargement mongoose:', error.message);
    return null;
  }
};

const connectDB = async () => {
  try {
    // Initialiser mongoose si nécessaire
    if (!mongoose) {
      initMongoDB();
      if (!mongoose) {
        throw new Error('Mongoose non disponible');
      }
    }

    // Vérifier MONGO_URI
    if (!process.env.MONGO_URI) {
      const errorMsg = 'MONGO_URI non défini dans les variables d\'environnement Vercel';
      console.error('❌', errorMsg);
      console.error('❌ Variables disponibles:', Object.keys(process.env).filter(k => k.includes('MONGO') || k.includes('DB')));
      throw new Error(errorMsg);
    }

    // Logger l'URI (sans afficher le mot de passe)
    const mongoUriDisplay = process.env.MONGO_URI.replace(/:[^:@]+@/, ':****@');
    console.log('🔄 Tentative de connexion MongoDB...', mongoUriDisplay.substring(0, 50) + '...');

    // Si déjà connecté, réutiliser
    if (mongoose.connection.readyState === 1) {
      mongoConnected = true;
      console.log('✅ MongoDB déjà connecté');
      return mongoose.connection;
    }

    // Si connexion en cours, attendre (avec timeout plus long)
    if (mongoose.connection.readyState === 2) {
      console.log('⏳ Connexion MongoDB en cours, attente...');
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: connexion en cours depuis plus de 15 secondes'));
        }, 15000);
        
        mongoose.connection.once('connected', () => {
          clearTimeout(timeout);
          mongoConnected = true;
          console.log('✅ MongoDB connecté (après attente)');
          resolve();
        });
        
        mongoose.connection.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      return mongoose.connection;
    }

    // Nouvelle connexion avec timeouts augmentés
    mongoConnectionAttempts++;
    console.log(`🔄 Tentative de connexion #${mongoConnectionAttempts}...`);
    
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000, // Augmenté à 15s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000, // Augmenté à 15s
      bufferMaxEntries: 0,
      bufferCommands: false,
    });
    
    mongoConnected = true;
    console.log('✅ MongoDB connecté avec succès');
    
    // Écouteurs d'événements
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB après connexion:', err.message);
      mongoConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB déconnecté');
      mongoConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnecté');
      mongoConnected = true;
    });

    return mongoose.connection;
  } catch (error) {
    mongoConnected = false;
    console.error('💥 Erreur connexion MongoDB:', error.message);
    console.error('💥 Stack:', error.stack);
    console.error('💥 MONGO_URI défini:', !!process.env.MONGO_URI);
    if (process.env.MONGO_URI) {
      const uriPreview = process.env.MONGO_URI.substring(0, 30) + '...';
      console.error('💥 MONGO_URI preview:', uriPreview);
    }
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
    const currentState = mongoose ? mongoose.connection.readyState : 0;
    if (!mongoConnected || currentState !== 1) {
      console.log(`🔄 [${req.method} ${req.path}] Connexion MongoDB nécessaire (état: ${currentState})`);
      await connectDB();
    }
    next();
  } catch (error) {
    console.error(`💥 [MIDDLEWARE] Erreur MongoDB pour ${req.method} ${req.path}:`, error.message);
    return res.status(503).json({ 
      message: 'Base de données non accessible',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Service temporairement indisponible',
      details: process.env.NODE_ENV === 'development' ? {
        mongoUriDefined: !!process.env.MONGO_URI,
        connectionState: mongoose ? mongoose.connection.readyState : 'mongoose not initialized',
        attempts: mongoConnectionAttempts
      } : undefined
    });
  }
});

// Route principale - TOUJOURS FONCTIONNELLE (même sans MongoDB)
app.get('/', (req, res) => {
  try {
    if (!mongoose) initMongoDB();
    const dbStatus = mongoose && mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({
      message: '✅ API Ecopower - Gestion de consommation électrique',
      status: 'online',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      platform: 'Vercel Serverless',
      database: {
        status: dbStatus,
        mongoUriDefined: !!process.env.MONGO_URI,
        connectionState: mongoose ? mongoose.connection.readyState : 'not initialized'
      }
    });
  } catch (error) {
    res.json({
      message: '✅ API Ecopower - Gestion de consommation électrique',
      status: 'online',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      platform: 'Vercel Serverless',
      database: {
        status: 'error',
        error: error.message
      }
    });
  }
});

// Route config
app.get('/config', (req, res) => {
  res.json({ freeMode: process.env.FREE_MODE === 'true' });
});

// Charger les routes avec gestion d'erreur robuste
const loadRoutes = () => {
  // Route auth - CRITIQUE
  try {
    const authRoutes = require('../routes/auth');
    app.use('/auth', authRoutes);
    console.log('✅ Route /auth chargée');
  } catch (error) {
    console.error('❌ Erreur route /auth:', error.message);
    console.error('❌ Stack:', error.stack);
    // Fallback pour /auth/login
    app.post('/auth/login', (req, res) => {
      res.status(500).json({ 
        message: 'Service temporairement indisponible',
        error: error.message 
      });
    });
  }

  // Autres routes
  const routes = [
    { path: '/residents', file: '../routes/residents' },
    { path: '/consommations', file: '../routes/consommations' },
    { path: '/factures', file: '../routes/factures' },
    { path: '/abonnements', file: '../routes/abonnements' },
    { path: '/maisons', file: '../routes/maisons' },
    { path: '/messages', file: '../routes/messages' },
    { path: '/admin', file: '../routes/admin' },
  ];

  routes.forEach(({ path, file }) => {
    try {
      const routeModule = require(file);
      app.use(path, routeModule);
      console.log(`✅ Route ${path} chargée`);
    } catch (error) {
      console.error(`❌ Erreur route ${path}:`, error.message);
      // Ne pas bloquer l'app si une route échoue
    }
  });
};

// Charger les routes dans un try-catch global
try {
  loadRoutes();
} catch (error) {
  console.error('💥 Erreur critique lors du chargement des routes:', error.message);
  console.error('💥 Stack:', error.stack);
  // L'app continue de fonctionner avec les routes de base
}

// Gestion d'erreurs globale
app.use((err, req, res, next) => {
  console.error('💥 Erreur non gérée:', err);
  console.error('💥 Stack:', err.stack);
  res.status(500).json({ 
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Export avec gestion d'erreur
module.exports = app;
