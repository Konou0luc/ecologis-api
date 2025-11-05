const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Charger dotenv seulement en développement local (pas sur Vercel)
if (process.env.VERCEL !== '1') {
  require('dotenv').config();
}

const app = express();
const PORT = process.env.PORT || 3000;

// CRITIQUE: Désactiver strict routing pour éviter les redirections de trailing slash
app.set('strict routing', false);

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
      console.log('[CORS] Origine bloquee:', origin);
      callback(null, true); // Autoriser temporairement pour debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 heures
};

// Liste des origines autorisées (réutilisable)
const getAllowedOrigins = () => [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://ecologis-web.vercel.app',
  'https://www.ecologis-web.vercel.app',
  'https://ecopower-website.vercel.app',
  'https://www.ecopower-website.vercel.app',
];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.includes(origin) ||
    /^https:\/\/.*\.vercel\.app$/.test(origin) ||
    /^https:\/\/.*\.netlify\.app$/.test(origin);
};

const handleOptionsRequest = (req, res) => {
  console.log('[CORS] Preflight request recue:', req.method, req.path, 'Origin:', req.headers.origin);
  
  if (isOriginAllowed(req.headers.origin)) {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  } else {
    console.log('[CORS] Origine non autorisee pour OPTIONS:', req.headers.origin);
    res.status(403).end();
  }
};

// SOLUTION DEFINITIVE: Créer un handler Express qui répond AVANT toute redirection Vercel
// Ce middleware DOIT être le PREMIER middleware pour capturer OPTIONS avant toute autre logique
const corsHandler = (req, res, next) => {
  // Intercepter OPTIONS immédiatement, SANS appeler next() pour éviter toute redirection
  if (req.method === 'OPTIONS') {
    console.log('[CORS] Interception OPTIONS directe:', req.path, 'Origin:', req.headers.origin);
    handleOptionsRequest(req, res);
    // CRITIQUE: Ne PAS appeler next() - terminer la réponse ici
    return;
  }
  next();
};

// Appliquer le handler CORS en PREMIER (avant trust proxy même)
app.use(corsHandler);

// Gérer aussi avec app.options() pour double sécurité
app.options('*', handleOptionsRequest);

app.use(cors(corsOptions));

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

// Middleware de logging pour debug
app.use((req, res, next) => {
  if (req.path.startsWith('/auth')) {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    console.log(`[REQUEST] Body:`, JSON.stringify(req.body));
    console.log(`[REQUEST] Headers:`, JSON.stringify(req.headers));
  }
  next();
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

app.get('/', (req, res) => {
  res.json({ message: 'API Ecopower - Gestion de consommation électrique' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

const connectDB = async () => {
  try {
    // Vérifier si déjà connecté (important pour Vercel serverless)
    if (mongoose.connection.readyState === 1) {
      console.log('Mongo déjà connecté');
      return;
    }
    
    mongoose.set('strictQuery', false);
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI n\'est pas défini');
      throw new Error('MONGO_URI environment variable is required');
    }
    await mongoose.connect(mongoUri);
    console.log('Mongo connecté');
  } catch (error) {
    console.error('Erreur connexion Mongo:', error.message);
    // Ne pas exit sur Vercel - laisser la fonction serverless gérer
    if (process.env.VERCEL !== '1') {
      process.exit(1);
    }
  }
};

// Connecter MongoDB de manière lazy (au premier appel sur Vercel)
let dbConnected = false;
const ensureDBConnected = async () => {
  if (!dbConnected) {
    await connectDB();
    dbConnected = true;
  }
};

// Middleware pour s'assurer que MongoDB est connecté avant chaque requête (Vercel)
// IMPORTANT: Ce middleware doit être APRÈS le handler CORS mais AVANT les routes
app.use(async (req, res, next) => {
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) {
    try {
      await ensureDBConnected();
    } catch (error) {
      console.error('[MONGODB] Erreur connexion:', error.message);
      // Ne pas bloquer la requête, mais logger l'erreur
    }
  }
  next();
});

// En développement local, démarrer le serveur normalement
if (process.env.VERCEL !== '1') {
  const start = async () => {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
    });

    const io = require('socket.io')(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    require('./sockets/socketManager')(io);

    const { initCronJobs } = require('./utils/cronJobs');
    initCronJobs();
  };

  start();
}

// Pour Vercel serverless, exporter l'app directement
module.exports = app;
