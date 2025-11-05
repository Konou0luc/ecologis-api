// Handler Vercel Serverless Function
// Ce fichier est automatiquement détecté par Vercel et gère toutes les routes
const app = require('../app');

module.exports = (req, res) => {
  return app(req, res);
};

