#!/bin/bash
# Démarre ou redémarre SocialNet avec PM2.
# À exécuter en tant qu'utilisateur socialnet.

set -euo pipefail

APP_DIR="/home/socialnet/socialnetapp"
cd "$APP_DIR"

if [ ! -f ".env" ]; then
  echo "Erreur : .env manquant. Copiez .env.example et remplissez les valeurs."
  exit 1
fi

export NODE_ENV=production

npm run build

if pm2 describe socialnet >/dev/null 2>&1; then
  pm2 restart socialnet
else
  pm2 start ecosystem.config.js
fi

pm2 save

if ! systemctl is-enabled pm2-socialnet >/dev/null 2>&1; then
  echo ""
  echo "Pour redémarrer automatiquement après un reboot, exécutez en root :"
  echo "  pm2 startup systemd -u socialnet --hp /home/socialnet"
  echo "  # puis copiez/collez la commande sudo affichée"
  echo "  sudo -u socialnet pm2 save"
fi

echo "SocialNet démarré. Logs : pm2 logs socialnet"