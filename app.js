const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Requis derrière un proxy (Vercel) pour que req.ip soit correct et
// que express-rate-limit n'échoue pas avec X-Forwarded-For
app.set('trust proxy', 1);

// Configuration CORS améliorée
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Liste des origines autorisées
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://ecologis-web.vercel.app',
      'https://www.ecologis-web.vercel.app',
      /^https:\/\/.*\.vercel\.app$/,
      /^https:\/\/.*\.netlify\.app$/,
    ];
    
    // Vérifier si l'origine est autorisée
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('⚠️ [CORS] Origine bloquée:', origin);
      callback(null, true); // Autoriser temporairement pour debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 heures
};

app.use(cors(corsOptions));

// Gérer explicitement les requêtes OPTIONS (preflight)
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 tentatives par IP (augmenté pour tests)
  message: 'Trop de tentatives, réessayez plus tard',
  standardHeaders: true, // Retourne les infos dans les headers RateLimit-*
  legacyHeaders: false, // Désactive X-RateLimit-*
});

const residentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requêtes par IP
  message: 'Trop de requêtes, réessayez plus tard',
  standardHeaders: true,
  legacyHeaders: false,
});

// Gérer les requêtes OPTIONS (preflight CORS) AVANT tout autre middleware
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log('✅ [CORS] Preflight request reçue:', req.path);
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  next();
});

// Middleware de logging pour debug
app.use((req, res, next) => {
  if (req.path.startsWith('/auth')) {
    console.log(`📥 [REQUEST] ${req.method} ${req.path}`);
    console.log(`📥 [REQUEST] Body:`, JSON.stringify(req.body));
    console.log(`📥 [REQUEST] Headers:`, JSON.stringify(req.headers));
  }
  next();
});

// Gestion de la connexion MongoDB réutilisable pour Vercel serverless
let mongoConnection = null;

const connectDB = async () => {
  try {
    // Vérifier que MONGO_URI est défini
    if (!process.env.MONGO_URI) {
      console.error('💥 [MongoDB] MONGO_URI n\'est pas défini dans les variables d\'environnement');
      throw new Error('MONGO_URI environment variable is not set');
    }

    // Si déjà connecté, réutiliser la connexion
    if (mongoose.connection.readyState === 1) {
      console.log('✅ [MongoDB] Connexion existante réutilisée');
      return mongoose.connection;
    }

    // Si une connexion est en cours, attendre
    if (mongoose.connection.readyState === 2) {
      console.log('⏳ [MongoDB] Connexion en cours, attente...');
      await new Promise((resolve) => {
        mongoose.connection.once('connected', resolve);
        mongoose.connection.once('error', resolve);
      });
      if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
      }
    }

    // Nouvelle connexion
    mongoose.set('strictQuery', false);
    
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGO_URI, options);
    console.log('✅ [MongoDB] Connexion établie');
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ [MongoDB] Erreur de connexion:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ [MongoDB] Déconnecté');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('💥 [MongoDB] Erreur lors de la connexion:', error);
    // Ne pas faire exit(1) sur Vercel, laisser la fonction se terminer
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

// Middleware pour s'assurer que MongoDB est connecté avant chaque requête
// (sauf pour la route principale qui doit fonctionner même sans DB)
app.use(async (req, res, next) => {
  // Laisser passer la route principale sans vérifier MongoDB
  if (req.path === '/' || req.path === '/config') {
    return next();
  }
  
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error('💥 [MIDDLEWARE] Erreur de connexion MongoDB:', error);
    res.status(503).json({ 
      message: 'Service temporairement indisponible - Base de données non accessible',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.use('/auth', authLimiter, require('./routes/auth'));
app.use('/residents', residentLimiter, require('./routes/residents'));
app.use('/consommations', require('./routes/consommations'));
app.use('/factures', require('./routes/factures'));
app.use('/abonnements', require('./routes/abonnements'));
app.use('/maisons', require('./routes/maisons'));
app.use('/messages', require('./routes/messages'));
app.use('/admin', require('./routes/admin'));

// Exposer config pour le frontend
app.get('/config', (req, res) => {
  res.json({ freeMode: process.env.FREE_MODE === 'true' });
});

// Route principale améliorée avec statut de l'API
app.get('/', async (req, res) => {
  try {
    // Vérifier la connexion MongoDB
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({ 
      message: '✅ API Ecopower - Gestion de consommation électrique',
      status: 'online',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: {
        status: mongoStatus,
        connected: mongoStatus === 'connected'
      },
      environment: process.env.NODE_ENV || 'development',
      platform: process.env.VERCEL ? 'Vercel Serverless' : 'Traditional Server'
    });
  } catch (error) {
    res.json({
      message: '✅ API Ecopower - Gestion de consommation électrique',
      status: 'online',
      timestamp: new Date().toISOString(),
      database: {
        status: 'unknown',
        connected: false
      },
      warning: 'Unable to check database status'
    });
  }
});

app.use((err, req, res, next) => {
  console.error('💥 [ERROR]', err.stack);
  res.status(500).json({ 
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Détecter si on est sur Vercel
const isVercel = !!process.env.VERCEL;

// Si on n'est pas sur Vercel, démarrer le serveur traditionnel
if (!isVercel) {
  const start = async () => {
    try {
      await connectDB();

      const server = app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      });

      // Socket.io uniquement en mode non-serverless
      try {
        const io = require('socket.io')(server, {
          cors: {
            origin: "*",
            methods: ["GET", "POST"]
          }
        });

        require('./sockets/socketManager')(io);
        console.log('✅ Socket.io initialisé');
      } catch (socketError) {
        console.warn('⚠️ Socket.io non disponible:', socketError.message);
      }

      // Cron jobs uniquement en mode non-serverless
      try {
        const { initCronJobs } = require('./utils/cronJobs');
        initCronJobs();
        console.log('✅ Cron jobs initialisés');
      } catch (cronError) {
        console.warn('⚠️ Cron jobs non disponibles:', cronError.message);
      }
    } catch (error) {
      console.error('💥 Erreur lors du démarrage du serveur:', error);
      process.exit(1);
    }
  };

  start();
} else {
  // Sur Vercel, NE PAS initialiser MongoDB au chargement
  // La connexion sera faite à la demande par le middleware
  console.log('🌐 [Vercel] Mode serverless détecté');
  // MongoDB sera connecté à la première requête via le middleware
}

module.exports = app;
