# Corrections pour le rôle "Résident" - API Ecologis

## Problèmes identifiés et corrigés

### 1. Erreur de syntaxe dans consommationsController.js
**Problème** : Erreur de syntaxe dans la fonction `getConsommationsByResident` (lignes 175-176)
```javascript
// AVANT (incorrect)
res
  .status(500)
({ message: "Erreur lors de la récupération des consommations" });

// APRÈS (corrigé)
res
  .status(500)
  .json({ message: "Erreur lors de la récupération des consommations" });
```

### 2. Logique d'autorisation incomplète pour les résidents
**Problème** : Les résidents ne pouvaient pas récupérer leurs propres données car :
- Les routes existantes nécessitaient un `residentId` dans l'URL
- La logique de vérification d'autorisation était complexe et sujette aux erreurs
- Pas de routes dédiées aux résidents

**Solution** : Ajout de nouvelles routes spécifiques aux résidents :
- `/consommations/my-consommations` - Consommations du résident connecté
- `/consommations/my-maison` - Consommations de la maison du résident
- `/factures/my-factures` - Factures du résident connecté
- `/factures/my-maison-factures` - Factures de la maison du résident

### 3. Récupération des maisons pour les résidents
**Problème** : Dans `authController.js`, la logique pour récupérer la maison d'un résident utilisait `user.maisonId` qui n'était pas toujours fiable.

**Solution** : Utilisation de la relation inverse via `listeResidents` :
```javascript
// AVANT
const maison = await Maison.findById(user.maisonId);

// APRÈS
const maison = await Maison.findOne({ listeResidents: user._id });
```

## Nouvelles fonctionnalités ajoutées

### Routes pour les résidents

#### Consommations
- `GET /consommations/my-consommations` - Récupère les consommations du résident connecté
- `GET /consommations/my-maison` - Récupère les consommations de la maison du résident

#### Factures
- `GET /factures/my-factures` - Récupère les factures du résident connecté
- `GET /factures/my-maison-factures` - Récupère les factures de la maison du résident

### Fonctions ajoutées dans les contrôleurs

#### consommationsController.js
- `getMyConsommations()` - Consommations du résident connecté
- `getMyMaisonConsommations()` - Consommations de la maison du résident

#### facturesController.js
- `getMyFactures()` - Factures du résident connecté
- `getMyMaisonFactures()` - Factures de la maison du résident

## Sécurité et autorisations

### Vérifications d'autorisation
Toutes les nouvelles fonctions vérifient que :
1. L'utilisateur est authentifié (middleware `authenticateToken`)
2. L'utilisateur a le rôle "resident"
3. Les données récupérées appartiennent bien au résident connecté

### Exemple de vérification
```javascript
if (req.user.role !== 'resident') {
  return res.status(403).json({ message: 'Accès non autorisé - Résident requis' });
}
```

## Structure des réponses JSON

### Consommations
```json
{
  "consommations": [...],
  "statistiques": {
    "totalKwh": 150,
    "totalMontant": 26100,
    "moyenneKwh": 75,
    "nombreReleves": 2
  },
  "message": "Consommations récupérées avec succès"
}
```

### Factures
```json
{
  "factures": [...],
  "statistiques": {
    "totalFactures": 3,
    "totalMontant": 45000,
    "totalPaye": 30000,
    "totalImpaye": 15000,
    "facturesPayees": 2,
    "facturesEnRetard": 1
  },
  "message": "Factures récupérées avec succès"
}
```

## Utilisation côté Flutter

### Pour récupérer les consommations d'un résident
```dart
// Récupérer ses propres consommations
GET /consommations/my-consommations

// Récupérer les consommations de sa maison
GET /consommations/my-maison
```

### Pour récupérer les factures d'un résident
```dart
// Récupérer ses propres factures
GET /factures/my-factures

// Récupérer les factures de sa maison
GET /factures/my-maison-factures
```

## Tests recommandés

1. **Test de connexion résident** : Vérifier que `/auth/me` retourne les bonnes données
2. **Test des consommations** : Vérifier que les routes `/my-consommations` et `/my-maison` fonctionnent
3. **Test des factures** : Vérifier que les routes `/my-factures` et `/my-maison-factures` fonctionnent
4. **Test de sécurité** : Vérifier qu'un résident ne peut pas accéder aux données d'un autre résident

## Notes importantes

- Les résidents ne peuvent accéder qu'à leurs propres données
- Les routes `/my-*` sont spécifiquement conçues pour les résidents
- Les routes existantes `/resident/:id` restent disponibles pour les propriétaires
- Toutes les réponses incluent des messages explicatifs pour faciliter le debugging
