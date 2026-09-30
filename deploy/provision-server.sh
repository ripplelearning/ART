#!/usr/bin/env bash
# One-time provisioning for an Ubuntu 24.04 LTS host that serves the ART web app.
# Run as root:  sudo bash provision-server.sh "ssh-ed25519 AAAA... github-deploy"
#
# Creates the unprivileged deploy account, the release directory layout, and a
# hardened nginx front end. Re-running is safe.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-artdeploy}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/art}"
SERVER_NAME="${SERVER_NAME:-art.example.com}"
DEPLOY_PUBLIC_KEY="${1:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root." >&2
  exit 1
fi

if [ -z "$DEPLOY_PUBLIC_KEY" ]; then
  echo "Usage: sudo bash provision-server.sh '<deploy public key>'" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y nginx rsync ufw fail2ban unattended-upgrades

# --- Deploy account -------------------------------------------------------
# No sudo rights, no login shell beyond what rsync/ssh needs.
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  adduser --system --group --shell /bin/bash --home "/home/$DEPLOY_USER" "$DEPLOY_USER"
fi

install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH_KEYS="/home/$DEPLOY_USER/.ssh/authorized_keys"
KEY_OPTIONS="no-agent-forwarding,no-port-forwarding,no-X11-forwarding,no-user-rc"
ENTRY="$KEY_OPTIONS $DEPLOY_PUBLIC_KEY"
touch "$AUTH_KEYS"
if ! grep -Fq "$DEPLOY_PUBLIC_KEY" "$AUTH_KEYS"; then
  printf '%s\n' "$ENTRY" >> "$AUTH_KEYS"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH_KEYS"
chmod 600 "$AUTH_KEYS"

# --- Release layout -------------------------------------------------------
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_ROOT"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_ROOT/releases"

# Placeholder so nginx can start before the first deployment.
if [ ! -e "$DEPLOY_ROOT/current" ]; then
  install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$DEPLOY_ROOT/releases/bootstrap"
  echo '<!doctype html><title>ART</title><p>Awaiting first deployment.</p>' \
    > "$DEPLOY_ROOT/releases/bootstrap/index.html"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_ROOT/releases/bootstrap/index.html"
  ln -sfn "$DEPLOY_ROOT/releases/bootstrap" "$DEPLOY_ROOT/current"
  chown -h "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_ROOT/current"
fi

# nginx (running as www-data) only needs traverse + read access.
chmod 755 "$DEPLOY_ROOT"

# --- nginx ----------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/nginx/art.conf" ]; then
  sed "s/art\.example\.com/$SERVER_NAME/g" "$SCRIPT_DIR/nginx/art.conf" \
    > /etc/nginx/sites-available/art
  ln -sfn /etc/nginx/sites-available/art /etc/nginx/sites-enabled/art
  rm -f /etc/nginx/sites-enabled/default
  echo "Installed /etc/nginx/sites-available/art for $SERVER_NAME."
  echo "Run certbot before reloading nginx, or comment out the TLS block first."
fi

# --- Firewall and updates -------------------------------------------------
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "Provisioning complete."
echo "  Deploy user : $DEPLOY_USER"
echo "  Deploy root : $DEPLOY_ROOT"
echo "  Host keys   : run 'ssh-keyscan -t ed25519 <host>' and store the output"
echo "                in the DEPLOY_KNOWN_HOSTS repository secret."
