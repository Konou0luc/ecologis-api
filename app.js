const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives par IP
  message: 'Trop de tentatives de connexion, réessayez plus tard'
});

const residentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requêtes par IP
  message: 'Trop de requêtes, réessayez plus tard'
});

// Routes
app.use('/auth', authLimiter, require('./routes/auth'));
app.use('/residents', residentLimiter, require('./routes/residents'));
app.use('/consommations', require('./routes/consommations'));
app.use('/factures', require('./routes/factures'));
app.use('/abonnements', require('./routes/abonnements'));
app.use('/maisons', require('./routes/maisons'));

// Route de test
app.get('/', (req, res) => {
  res.json({ message: 'API Ecologis - Gestion de consommation électrique' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Connexion MongoDB (style préféré)
const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Mongo connecté');
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

const start = async () => {
  await connectDB();

  // Démarrer le serveur
  const server = app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });

  // Configuration Socket.io
  const io = require('socket.io')(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Initialiser les sockets
  require('./sockets/socketManager')(io);

  // Initialiser les tâches cron
  const { initCronJobs } = require('./utils/cronJobs');
  initCronJobs();
};

start();

module.exports = app;
