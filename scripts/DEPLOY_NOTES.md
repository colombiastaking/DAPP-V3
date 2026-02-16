# ⚠️ NOTES IMPORTANTES POUR LE DÉPLOIEMENT

## Fichiers à NE JAMAIS supprimer sur CPanel

Ces fichiers sont critiques et ne doivent PAS être écrasés lors d'un déploiement:

1. **mvx-api.php** - Contient la clé API Kepler (SECRET)
   - Chemin: `/home/colombia6/staking.colombia-staking.com/mvx-api.php`
   - Clé: acea534bc927840076692374ffab66fb
   - ⚠️ NE JAMAIS PUSHER SUR GITHUB (repo public)

2. **colombia-staking-logo.png** - Logo du site
   - Peut être push sur GitHub

## Procédure de déploiement sécurisée

```bash
# 1. Builder le DApp
npm run build

# 2. Push sur GitHub (SANS mvx-api.php)
git add .
git commit -m "Update DApp"
git push

# 3. Déployer sur CPanel (ne PAS écraser mvx-api.php)
# Uploader seulement: index.html, assets/, et autres fichiers sauf mvx-api.php
```

## Fichier local sensible

- `/home/raspberry/.openclaw/workspace/colombia-staking-dapp/public/mvx-api.php`
- Ce fichier est dans .gitignore et ne sera jamais push
