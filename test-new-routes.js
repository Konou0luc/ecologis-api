/**
 * Script de test pour les nouvelles routes résident
 * Usage: node test-new-routes.js
 */

const axios = require('axios');

const BASE_URL = 'https://ecologis-api.vercel.app';

// Token d'un résident (à remplacer par un vrai token)
const RESIDENT_TOKEN = 'YOUR_RESIDENT_TOKEN_HERE';

async function testNewRoutes() {
  console.log('🧪 [TEST] Test des nouvelles routes résident...\n');

  const headers = {
    'Authorization': `Bearer ${RESIDENT_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Route /consommations/my-consommations
    console.log('1️⃣ Test route /consommations/my-consommations...');
    try {
      const response1 = await axios.get(`${BASE_URL}/consommations/my-consommations`, { headers });
      console.log('✅ Succès:', response1.status);
      console.log('📊 Données:', response1.data);
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data);
    }

    console.log('\n2️⃣ Test route /consommations/my-maison...');
    try {
      const response2 = await axios.get(`${BASE_URL}/consommations/my-maison`, { headers });
      console.log('✅ Succès:', response2.status);
      console.log('📊 Données:', response2.data);
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data);
    }

    console.log('\n3️⃣ Test route /factures/my-factures...');
    try {
      const response3 = await axios.get(`${BASE_URL}/factures/my-factures`, { headers });
      console.log('✅ Succès:', response3.status);
      console.log('📊 Données:', response3.data);
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data);
    }

    console.log('\n4️⃣ Test route /factures/my-maison-factures...');
    try {
      const response4 = await axios.get(`${BASE_URL}/factures/my-maison-factures`, { headers });
      console.log('✅ Succès:', response4.status);
      console.log('📊 Données:', response4.data);
    } catch (error) {
      console.log('❌ Erreur:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('💥 Erreur générale:', error.message);
  }
}

// Fonction pour tester avec un token de propriétaire (doit échouer)
async function testWithProprietaireToken() {
  console.log('\n🔒 [TEST] Test avec token propriétaire (doit échouer)...\n');

  const PROPRIETAIRE_TOKEN = 'YOUR_PROPRIETAIRE_TOKEN_HERE';
  const headers = {
    'Authorization': `Bearer ${PROPRIETAIRE_TOKEN}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.get(`${BASE_URL}/consommations/my-consommations`, { headers });
    console.log('❌ Erreur: La route devrait être interdite aux propriétaires');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Succès: Route correctement interdite aux propriétaires');
    } else {
      console.log('❌ Erreur inattendue:', error.response?.status, error.response?.data);
    }
  }
}

// Exécuter les tests
if (require.main === module) {
  console.log('⚠️  IMPORTANT: Remplacez les tokens dans le script avant de l\'exécuter !\n');
  
  // Décommenter pour tester
  // testNewRoutes();
  // testWithProprietaireToken();
  
  console.log('Pour tester, décommentez les lignes ci-dessus et remplacez les tokens.');
}

module.exports = { testNewRoutes, testWithProprietaireToken };
