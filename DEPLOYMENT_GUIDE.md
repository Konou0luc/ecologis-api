# Guide de déploiement - Nouvelles routes résident

## Problème identifié

Les nouvelles routes `/my-consommations` et `/my-factures` retournent des erreurs 500 car le middleware de vérification d'abonnement bloque les résidents.

## Corrections apportées

### 1. Routes consommations (`routes/consommations.js`)
- ✅ Ajout des routes `/my-consommations` et `/my-maison`
- ✅ Correction du middleware pour permettre l'accès aux résidents

### 2. Routes factures (`routes/factures.js`)
- ✅ Ajout des routes `/my-factures` et `/my-maison-factures`
- ✅ Correction du middleware pour permettre l'accès aux résidents

### 3. Contrôleurs
- ✅ `consommationsController.js` : Fonctions `getMyConsommations` et `getMyMaisonConsommations`
- ✅ `facturesController.js` : Fonctions `getMyFactures` et `getMyMaisonFactures`

## Étapes de déploiement

### 1. Vérifier les changements
```bash
git status
git diff
```

### 2. Commiter les changements
```bash
git add .
git commit -m "fix: Correction middleware abonnement pour routes résident

- Correction du middleware checkSubscription dans routes/consommations.js
- Correction du middleware checkSubscription dans routes/factures.js
- Les routes /my-consommations et /my-factures sont maintenant accessibles aux résidents
- Ajout de la logique pour détecter les routes /my-* et /resident/*
- Résolution des erreurs 500 pour les résidents"
```

### 3. Pousser vers le repository
```bash
git push origin main
```

### 4. Vérifier le déploiement Vercel
- Aller sur [Vercel Dashboard](https://vercel.com/dashboard)
- Vérifier que le déploiement est en cours
- Attendre la fin du déploiement

### 5. Tester les nouvelles routes
```bash
# Tester avec un token de résident
curl -H "Authorization: Bearer YOUR_RESIDENT_TOKEN" \
     https://ecologis-api.vercel.app/consommations/my-consommations

curl -H "Authorization: Bearer YOUR_RESIDENT_TOKEN" \
     https://ecologis-api.vercel.app/factures/my-factures
```

## Routes ajoutées

### Consommations
- `GET /consommations/my-consommations` - Consommations du résident connecté
- `GET /consommations/my-maison` - Consommations de la maison du résident

### Factures
- `GET /factures/my-factures` - Factures du résident connecté
- `GET /factures/my-maison-factures` - Factures de la maison du résident

## Sécurité

- ✅ Seuls les résidents peuvent accéder à ces routes
- ✅ Les résidents ne peuvent voir que leurs propres données
- ✅ Pas de vérification d'abonnement pour les résidents
- ✅ Authentification JWT requise

## Test Flutter

Une fois le déploiement terminé, tester dans l'app Flutter :

1. Se connecter avec un compte résident
2. Aller sur le dashboard résident
3. Vérifier que les consommations et factures se chargent
4. Vérifier les logs dans la console Flutter

## Rollback si nécessaire

Si des problèmes surviennent, revenir à la version précédente :

```bash
git revert HEAD
git push origin main
```
