// Handler Vercel Serverless Function
// Ce fichier est automatiquement détecté par Vercel et gère toutes les routes

const expressApp = require('../app');

// Liste des origines autorisées
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

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  return allowedOrigins.includes(origin) ||
    /^https:\/\/.*\.vercel\.app$/.test(origin) ||
    /^https:\/\/.*\.netlify\.app$/.test(origin);
};

const handleCORS = (req, res) => {
  const origin = req.headers.origin;
  
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  
  // Pour OPTIONS, répondre immédiatement avec 200
  if (req.method === 'OPTIONS') {
    console.log('[API/INDEX] OPTIONS:', req.url, 'Origin:', origin);
    return res.status(200).end();
  }
};

module.exports = (req, res) => {
  // Appliquer CORS AVANT de passer à Express
  handleCORS(req, res);
  
  // Si OPTIONS, on a déjà répondu, sinon passer à Express
  if (req.method !== 'OPTIONS') {
    return expressApp(req, res);
  }
};

