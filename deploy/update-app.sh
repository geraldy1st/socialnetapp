#!/bin/bash
# Met à jour l'application après un git push.
# À exécuter en tant qu'utilisateur socialnet.

set -euo pipefail

APP_DIR="/home/socialnet/socialnetapp"
cd "$APP_DIR"

git pull origin master
npm ci
npm run build
pm2 restart socialnet

echo "Mise à jour terminée."