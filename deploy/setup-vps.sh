#!/bin/bash
# Configuration initiale d'un VPS Ubuntu 22.04/24.04 sur Oracle Cloud (Always Free).
# À exécuter en root : bash setup-vps.sh

set -euo pipefail

APP_USER="socialnet"
APP_DIR="/home/${APP_USER}/socialnetapp"
REPO_URL="https://github.com/geraldy1st/socialnetapp.git"

echo "=== Mise à jour du système ==="
apt-get update -y
apt-get upgrade -y

echo "=== Paquets de base ==="
apt-get install -y curl git nginx ufw build-essential

echo "=== Node.js 20 ==="
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "=== PM2 ==="
npm install -g pm2

echo "=== Utilisateur applicatif ==="
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
fi

echo "=== Pare-feu UFW ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== Dossiers uploads persistants ==="
mkdir -p "$APP_DIR/public/uploads/posts"
mkdir -p "$APP_DIR/public/uploads/avatars"
chown -R "$APP_USER:$APP_USER" "/home/${APP_USER}"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "=== Clone du dépôt ==="
  sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR"
else
  echo "=== Dépôt déjà présent, pull ==="
  sudo -u "$APP_USER" git -C "$APP_DIR" pull origin master
fi

echo "=== Installation des dépendances ==="
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && npm ci && npm run build"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "=== Fichier .env à créer ==="
  sudo -u "$APP_USER" cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo ""
  echo "IMPORTANT : éditez $APP_DIR/.env avant de démarrer :"
  echo "  nano $APP_DIR/.env"
  echo ""
fi

PUBLIC_IP=$(curl -fsSL https://ifconfig.me || hostname -I | awk '{print $1}')
echo ""
echo "=== IP publique détectée : $PUBLIC_IP ==="
echo "Ajoutez cette IP dans MongoDB Atlas → Network Access → Add IP Address"
echo ""

echo "=== Nginx ==="
sed "s/YOUR_DOMAIN/${PUBLIC_IP}/g" "$APP_DIR/deploy/nginx-socialnet.conf" > /etc/nginx/sites-available/socialnet
ln -sf /etc/nginx/sites-available/socialnet /etc/nginx/sites-enabled/socialnet
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx
systemctl restart nginx

echo ""
echo "=== Prochaines étapes (en root) ==="
echo "1. Éditer le .env : nano $APP_DIR/.env"
echo "   - CONNECTIONSTRING (MongoDB Atlas)"
echo "   - SESSION_SECRET (chaîne longue aléatoire)"
echo "   - JWTSECRET (chaîne longue aléatoire)"
echo "   - NODE_ENV=production"
echo "   - PORT=3000"
echo ""
echo "2. Démarrer l'app : sudo -u $APP_USER bash $APP_DIR/deploy/start-app.sh"
echo ""
echo "3. Ouvrir dans Oracle Cloud → Networking → Security List :"
echo "   - Ingress TCP 80, 443 depuis 0.0.0.0/0"
echo ""
echo "4. (Optionnel) HTTPS avec domaine :"
echo "   apt-get install -y certbot python3-certbot-nginx"
echo "   certbot --nginx -d votre-domaine.com"
echo ""
echo "Terminé."