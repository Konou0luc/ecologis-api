/**
 * Script de test pour les routes résident
 * Usage: node test-resident-routes.js
 */

const axios = require('axios');

const BASE_URL = 'https://ecologis-api.vercel.app';

// Configuration pour les tests
const testConfig = {
  // Remplacez par un token de résident valide
  residentToken: 'YOUR_RESIDENT_TOKEN_HERE',
  // Remplacez par un token de propriétaire valide
  proprietaireToken: 'YOUR_PROPRIETAIRE_TOKEN_HERE'
};

// Fonction pour tester une route
async function testRoute(method, url, token, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${url}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log(`✅ ${method} ${url} - Status: ${response.status}`);
    console.log(`   Response: ${JSON.stringify(response.data, null, 2).substring(0, 200)}...`);
    return response.data;
  } catch (error) {
    console.log(`❌ ${method} ${url} - Error: ${error.response?.status || error.message}`);
    if (error.response?.data) {
      console.log(`   Error Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return null;
  }
}

// Tests pour les résidents
async function testResidentRoutes() {
  console.log('🧪 Test des routes résident...\n');
  
  if (testConfig.residentToken === 'YOUR_RESIDENT_TOKEN_HERE') {
    console.log('⚠️  Veuillez configurer un token de résident valide dans testConfig');
    return;
  }
  
  // Test 1: Récupérer les informations du résident connecté
  console.log('1. Test /auth/me (résident)');
  await testRoute('GET', '/auth/me', testConfig.residentToken);
  
  // Test 2: Récupérer les consommations du résident
  console.log('\n2. Test /consommations/my-consommations');
  await testRoute('GET', '/consommations/my-consommations', testConfig.residentToken);
  
  // Test 3: Récupérer les consommations de la maison du résident
  console.log('\n3. Test /consommations/my-maison');
  await testRoute('GET', '/consommations/my-maison', testConfig.residentToken);
  
  // Test 4: Récupérer les factures du résident
  console.log('\n4. Test /factures/my-factures');
  await testRoute('GET', '/factures/my-factures', testConfig.residentToken);
  
  // Test 5: Récupérer les factures de la maison du résident
  console.log('\n5. Test /factures/my-maison-factures');
  await testRoute('GET', '/factures/my-maison-factures', testConfig.residentToken);
  
  // Test 6: Vérifier que les routes propriétaire ne sont pas accessibles
  console.log('\n6. Test d\'accès non autorisé aux routes propriétaire');
  await testRoute('GET', '/consommations/resident/123', testConfig.residentToken);
  await testRoute('GET', '/factures/resident/123', testConfig.residentToken);
}

// Tests pour les propriétaires
async function testProprietaireRoutes() {
  console.log('\n🧪 Test des routes propriétaire...\n');
  
  if (testConfig.proprietaireToken === 'YOUR_PROPRIETAIRE_TOKEN_HERE') {
    console.log('⚠️  Veuillez configurer un token de propriétaire valide dans testConfig');
    return;
  }
  
  // Test 1: Récupérer les informations du propriétaire connecté
  console.log('1. Test /auth/me (propriétaire)');
  await testRoute('GET', '/auth/me', testConfig.proprietaireToken);
  
  // Test 2: Récupérer les consommations d'un résident (propriétaire)
  console.log('\n2. Test /consommations/resident/:id (propriétaire)');
  // Remplacez par un ID de résident valide
  await testRoute('GET', '/consommations/resident/REPLACE_WITH_RESIDENT_ID', testConfig.proprietaireToken);
  
  // Test 3: Récupérer les factures d'un résident (propriétaire)
  console.log('\n3. Test /factures/resident/:id (propriétaire)');
  // Remplacez par un ID de résident valide
  await testRoute('GET', '/factures/resident/REPLACE_WITH_RESIDENT_ID', testConfig.proprietaireToken);
}

// Fonction principale
async function runTests() {
  console.log('🚀 Démarrage des tests des routes résident...\n');
  
  await testResidentRoutes();
  await testProprietaireRoutes();
  
  console.log('\n✅ Tests terminés !');
  console.log('\n📝 Instructions pour utiliser ce script :');
  console.log('1. Remplacez YOUR_RESIDENT_TOKEN_HERE par un token de résident valide');
  console.log('2. Remplacez YOUR_PROPRIETAIRE_TOKEN_HERE par un token de propriétaire valide');
  console.log('3. Remplacez REPLACE_WITH_RESIDENT_ID par un ID de résident valide');
  console.log('4. Exécutez: node test-resident-routes.js');
}

// Exécuter les tests
runTests().catch(console.error);
