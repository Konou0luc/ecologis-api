# Correction des conflits de routes - Nouvelles routes résident

## Problèmes identifiés

### 1. **Conflit de routes Express**
Les routes `/my-factures` et `/my-consommations` étaient définies **après** les routes `/:id`, causant des conflits :
- Express interprétait "my-factures" comme un ID de facture
- Erreur : `Cast to ObjectId failed for value "my-factures"`

### 2. **Erreur dans le modèle Maison**
La propriété virtuelle `nbResidents` tentait d'accéder à `listeResidents.length` quand `listeResidents` était `undefined`.

## Corrections apportées

### 1. **Réorganisation des routes** (`routes/factures.js` et `routes/consommations.js`)

**AVANT (problématique) :**
```javascript
// GET /factures/:id - Obtenir une facture spécifique
router.get('/:id', facturesController.getFacture);

// GET /factures/my-factures - Factures du résident connecté
router.get('/my-factures', facturesController.getMyFactures); // ❌ Conflit !
```

**APRÈS (corrigé) :**
```javascript
// GET /factures/my-factures - Factures du résident connecté
router.get('/my-factures', facturesController.getMyFactures); // ✅ Avant /:id

// GET /factures/:id - Obtenir une facture spécifique
router.get('/:id', facturesController.getFacture);
```

### 2. **Correction du modèle Maison** (`models/Maison.js`)

**AVANT (problématique) :**
```javascript
maisonSchema.virtual('nbResidents').get(function() {
  return this.listeResidents.length; // ❌ Erreur si undefined
});
```

**APRÈS (corrigé) :**
```javascript
maisonSchema.virtual('nbResidents').get(function() {
  return this.listeResidents ? this.listeResidents.length : 0; // ✅ Sécurisé
});
```

### 3. **Sécurisation des méthodes**

```javascript
// Méthode pour ajouter un résident
maisonSchema.methods.ajouterResident = function(residentId) {
  if (!this.listeResidents) {
    this.listeResidents = []; // ✅ Initialisation sécurisée
  }
  // ... reste du code
};
```

## Ordre des routes (IMPORTANT)

### Routes factures
1. `POST /generer/:residentId`
2. `GET /resident/:residentId`
3. `GET /maison/:maisonId`
4. **`GET /my-factures`** ← Avant /:id
5. **`GET /my-maison-factures`** ← Avant /:id
6. `GET /:id`
7. `PUT /:id/payer`

### Routes consommations
1. `POST /`
2. `GET /resident/:residentId`
3. `GET /maison/:maisonId`
4. **`GET /my-consommations`** ← Avant /:id
5. **`GET /my-maison`** ← Avant /:id
6. `PUT /:id`
7. `DELETE /:id`

## Test des corrections

### 1. Vérifier l'ordre des routes
```bash
# Ces routes doivent maintenant fonctionner
curl -H "Authorization: Bearer RESIDENT_TOKEN" \
     https://ecologis-api.vercel.app/consommations/my-consommations

curl -H "Authorization: Bearer RESIDENT_TOKEN" \
     https://ecologis-api.vercel.app/factures/my-factures
```

### 2. Vérifier qu'elles ne sont plus interprétées comme des IDs
- Les routes `/my-*` ne doivent plus générer d'erreurs `Cast to ObjectId`
- Les routes `/:id` doivent toujours fonctionner avec de vrais IDs

## Déploiement

```bash
git add .
git commit -m "fix: Correction conflits routes et modèle Maison

- Réorganisation des routes /my-* avant /:id pour éviter les conflits
- Correction de la propriété virtuelle nbResidents dans le modèle Maison
- Sécurisation des méthodes ajouterResident et retirerResident
- Résolution des erreurs Cast to ObjectId pour les routes résident"

git push origin main
```

## Résultat attendu

- ✅ Routes `/my-consommations` et `/my-factures` fonctionnelles
- ✅ Plus d'erreurs `Cast to ObjectId failed for value "my-factures"`
- ✅ Plus d'erreurs `Cannot read properties of undefined (reading 'length')`
- ✅ Routes `/:id` toujours fonctionnelles avec de vrais IDs
