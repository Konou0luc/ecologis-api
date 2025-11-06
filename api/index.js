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
let mongoConnectionPromise = null;

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
  // Si une connexion est déjà en cours, réutiliser la promesse
  if (mongoConnectionPromise) {
    console.log('⏳ Réutilisation de la connexion en cours...');
    return mongoConnectionPromise;
  }

  mongoConnectionPromise = (async () => {
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
        throw new Error(errorMsg);
      }

      // Si déjà connecté, réutiliser
      if (mongoose.connection.readyState === 1) {
        mongoConnected = true;
        console.log('✅ MongoDB déjà connecté');
        return mongoose.connection;
      }

      // Logger l'URI (sans afficher le mot de passe)
      const mongoUriDisplay = process.env.MONGO_URI.replace(/:[^:@]+@/, ':****@');
      console.log('🔄 Tentative de connexion MongoDB...', mongoUriDisplay.substring(0, 60) + '...');

      // Si connexion en cours, attendre
      if (mongoose.connection.readyState === 2) {
        console.log('⏳ Connexion MongoDB en cours, attente...');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout: connexion en cours depuis plus de 20 secondes'));
          }, 20000);
          
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

      // Nouvelle connexion avec options optimisées pour Vercel
      mongoConnectionAttempts++;
      console.log(`🔄 Tentative de connexion #${mongoConnectionAttempts}...`);
      
      // Options de connexion optimisées pour Vercel serverless
      // Note: bufferMaxEntries et sslValidate ne sont plus supportés dans les nouvelles versions
      const connectionOptions = {
        maxPoolSize: 10,
        minPoolSize: 1,
        serverSelectionTimeoutMS: 20000, // 20 secondes
        socketTimeoutMS: 45000,
        connectTimeoutMS: 20000, // 20 secondes
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true,
        // Pour MongoDB Atlas - utiliser tls au lieu de ssl
        tls: true,
        tlsAllowInvalidCertificates: false,
      };

      // Si l'URI contient déjà des options TLS/SSL, ne pas forcer
      if (process.env.MONGO_URI.includes('ssl=') || process.env.MONGO_URI.includes('tls=')) {
        delete connectionOptions.tls;
        delete connectionOptions.tlsAllowInvalidCertificates;
      }

      await mongoose.connect(process.env.MONGO_URI, connectionOptions);
      
      mongoConnected = true;
      console.log('✅ MongoDB connecté avec succès');
      
      // Écouteurs d'événements
      mongoose.connection.on('error', (err) => {
        console.error('❌ Erreur MongoDB après connexion:', err.message);
        mongoConnected = false;
        mongoConnectionPromise = null; // Permettre une nouvelle tentative
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB déconnecté');
        mongoConnected = false;
        mongoConnectionPromise = null; // Permettre une nouvelle tentative
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnecté');
        mongoConnected = true;
      });

      return mongoose.connection;
    } catch (error) {
      mongoConnected = false;
      mongoConnectionPromise = null; // Permettre une nouvelle tentative
      console.error('💥 Erreur connexion MongoDB:', error.message);
      console.error('💥 Type d\'erreur:', error.name);
      console.error('💥 Code d\'erreur:', error.code);
      if (error.message.includes('authentication failed')) {
        console.error('💥 Problème d\'authentification - vérifiez le nom d\'utilisateur et le mot de passe');
      }
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        console.error('💥 Problème de résolution DNS - vérifiez l\'URI MongoDB');
      }
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        console.error('💥 Timeout de connexion - vérifiez les restrictions IP sur MongoDB Atlas');
        console.error('💥 Assurez-vous que "Allow access from anywhere" (0.0.0.0/0) est activé');
      }
      throw error;
    }
  })();

  return mongoConnectionPromise;
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
      hint: error.message.includes('timeout') || error.message.includes('ETIMEDOUT') 
        ? 'Vérifiez les restrictions IP sur MongoDB Atlas (doit autoriser 0.0.0.0/0)'
        : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        mongoUriDefined: !!process.env.MONGO_URI,
        connectionState: mongoose ? mongoose.connection.readyState : 'mongoose not initialized',
        attempts: mongoConnectionAttempts,
        errorType: error.name,
        errorCode: error.code
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
      
      // Log supplémentaire pour les routes admin
      if (path === '/admin') {
        console.log(`✅ Routes admin montées sur ${path}`);
        // Vérifier que le router a bien des routes
        if (routeModule && routeModule.stack) {
          console.log(`✅ Routes admin disponibles:`, routeModule.stack.map(layer => layer.route?.path || layer.regexp.toString()).slice(0, 5));
        }
      }
    } catch (error) {
      console.error(`❌ Erreur route ${path}:`, error.message);
      console.error(`❌ Stack pour ${path}:`, error.stack);
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

// 404 avec plus de détails pour debug
app.use((req, res) => {
  console.log(`⚠️ Route non trouvée: ${req.method} ${req.path}`);
  console.log(`⚠️ Routes disponibles:`, app._router?.stack?.map(layer => {
    if (layer.route) {
      return `${Object.keys(layer.route.methods).join(',').toUpperCase()} ${layer.route.path}`;
    }
    return null;
  }).filter(Boolean).slice(0, 10) || 'Aucune route trouvée');
  res.status(404).json({ 
    message: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// Export avec gestion d'erreur
module.exports = app;
