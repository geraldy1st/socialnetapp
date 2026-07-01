#!/bin/bash
# Oracle Cloud bloque parfois le trafic HTTP/HTTPS via iptables malgré UFW.
# À exécuter en root si le site ne répond pas depuis l'extérieur.

set -euo pipefail

iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
netfilter-persistent save 2>/dev/null || iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

echo "Ports 80 et 443 ouverts dans iptables."