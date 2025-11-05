// Handler serverless pour Vercel
// Import l'app Express (qui gère déjà MongoDB)
const app = require('../app');

// Export handler pour Vercel
// Vercel détecte automatiquement les exports de fonctions serverless dans api/
module.exports = app;

