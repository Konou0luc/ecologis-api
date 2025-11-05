// Handler serverless pour Vercel
// Import l'app Express
const app = require('../app');

// Export handler pour Vercel serverless functions
// Vercel détecte automatiquement les fichiers dans api/ et les traite comme serverless functions
module.exports = app;

