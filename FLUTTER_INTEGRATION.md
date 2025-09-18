# Intégration Flutter - API Ecologis

## Routes pour les résidents

### Authentification
```dart
// Récupérer les informations du résident connecté
GET /auth/me
Headers: Authorization: Bearer {token}
```

### Consommations
```dart
// Récupérer les consommations du résident connecté
GET /consommations/my-consommations
Headers: Authorization: Bearer {token}
Query params: ?annee=2024&mois=12 (optionnel)

// Récupérer les consommations de la maison du résident
GET /consommations/my-maison
Headers: Authorization: Bearer {token}
Query params: ?annee=2024&mois=12 (optionnel)
```

### Factures
```dart
// Récupérer les factures du résident connecté
GET /factures/my-factures
Headers: Authorization: Bearer {token}
Query params: ?statut=payée&annee=2024 (optionnel)

// Récupérer les factures de la maison du résident
GET /factures/my-maison-factures
Headers: Authorization: Bearer {token}
Query params: ?statut=payée&annee=2024 (optionnel)
```

## Structure des réponses

### Consommations
```json
{
  "consommations": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "residentId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "maisonId": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
        "nomMaison": "Villa Rose",
        "adresse": {
          "rue": "Rue de la Paix",
          "ville": "Lomé",
          "codePostal": "00228"
        }
      },
      "previousIndex": 1000,
      "currentIndex": 1200,
      "kwh": 200,
      "montant": 34800,
      "mois": 12,
      "annee": 2024,
      "periode": "Décembre 2024",
      "commentaire": "Relevé mensuel",
      "statut": "enregistree",
      "dateReleve": "2024-12-01T10:00:00.000Z",
      "createdAt": "2024-12-01T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  ],
  "statistiques": {
    "totalKwh": 400,
    "totalMontant": 69600,
    "moyenneKwh": 200,
    "nombreReleves": 2
  },
  "message": "Consommations récupérées avec succès"
}
```

### Factures
```json
{
  "factures": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d3",
      "residentId": "64f8a1b2c3d4e5f6a7b8c9d1",
      "maisonId": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d2",
        "nomMaison": "Villa Rose",
        "adresse": {
          "rue": "Rue de la Paix",
          "ville": "Lomé",
          "codePostal": "00228"
        }
      },
      "consommationId": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
        "kwh": 200,
        "mois": 12,
        "annee": 2024
      },
      "montant": 34800,
      "statut": "non payée",
      "numeroFacture": "FACT-202412-0001",
      "dateEmission": "2024-12-01T10:00:00.000Z",
      "dateEcheance": "2024-12-31T10:00:00.000Z",
      "datePaiement": null,
      "details": {
        "kwh": 200,
        "prixKwh": 0.174,
        "fraisFixes": 0
      },
      "commentaire": null,
      "createdAt": "2024-12-01T10:00:00.000Z",
      "updatedAt": "2024-12-01T10:00:00.000Z"
    }
  ],
  "statistiques": {
    "totalFactures": 3,
    "totalMontant": 104400,
    "totalPaye": 69600,
    "totalImpaye": 34800,
    "facturesPayees": 2,
    "facturesEnRetard": 1
  },
  "message": "Factures récupérées avec succès"
}
```

## Codes d'erreur

### 401 - Non authentifié
```json
{
  "message": "Token manquant ou invalide"
}
```

### 403 - Accès non autorisé
```json
{
  "message": "Accès non autorisé - Résident requis"
}
```

### 404 - Ressource non trouvée
```json
{
  "message": "Aucune maison trouvée pour ce résident"
}
```

### 500 - Erreur serveur
```json
{
  "message": "Erreur lors de la récupération des consommations"
}
```

## Exemple d'implémentation Flutter

```dart
class ConsommationService {
  static const String baseUrl = 'https://ecologis-api.vercel.app';
  
  Future<Map<String, dynamic>> getMyConsommations(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/consommations/my-consommations'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Erreur: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Erreur de connexion: $e');
    }
  }
  
  Future<Map<String, dynamic>> getMyFactures(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/factures/my-factures'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Erreur: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Erreur de connexion: $e');
    }
  }
}
```

## Notes importantes

1. **Sécurité** : Les résidents ne peuvent accéder qu'à leurs propres données
2. **Tokens** : Utilisez toujours le token d'authentification dans l'en-tête Authorization
3. **Gestion d'erreurs** : Implémentez une gestion d'erreurs robuste pour les codes 401, 403, 404, 500
4. **Pagination** : Pour l'instant, toutes les données sont retournées d'un coup. La pagination sera ajoutée dans une version future
5. **Filtres** : Utilisez les paramètres de requête pour filtrer par année, mois, statut, etc.

## Tests

Utilisez le script `test-resident-routes.js` pour tester les routes :
```bash
node test-resident-routes.js
```
