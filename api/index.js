// Handler Vercel Serverless Function
// Ce fichier est automatiquement détecté par Vercel et gère toutes les routes
let app = null;

// Charger l'app de manière lazy pour éviter les erreurs au démarrage
const getApp = () => {
  if (!app) {
    try {
      app = require('../app');
    } catch (error) {
      console.error('[API/INDEX] Erreur chargement app:', error);
      throw error;
    }
  }
  return app;
};

module.exports = async (req, res) => {
  try {
    // Gérer OPTIONS directement ici AVANT d'appeler app() pour garantir que ça fonctionne
    if (req.method === 'OPTIONS') {
      console.log('[API/INDEX] OPTIONS request intercepted:', req.url, 'Origin:', req.headers.origin);
      
      const origin = req.headers.origin || '*';
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:5174',
        'https://ecologis-web.vercel.app',
        'https://www.ecologis-web.vercel.app',
        'https://ecopower-website.vercel.app',
        'https://www.ecopower-website.vercel.app',
      ];
      
      const isAllowed = !origin || 
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin) ||
        /^https:\/\/.*\.netlify\.app$/.test(origin);
      
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(200).end();
      } else {
        console.log('[API/INDEX] Origin not allowed:', origin);
        return res.status(403).end();
      }
    }
    
    // Pour toutes les autres requêtes, passer à l'app Express
    const expressApp = getApp();
    return expressApp(req, res);
  } catch (error) {
    console.error('[API/INDEX] Erreur:', error);
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: error.message 
    });
  }
};

