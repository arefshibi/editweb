#!/usr/bin/env bash
set -e
[ "$(id -u)" = 0 ] || { echo "با root اجرا کن (sudo -i)"; exit 1; }

PROJECT_DIR="${PROJECT_DIR:-/root/ccc/carmaa}"
DOMAIN="${DOMAIN:-carma-app.ir}"
COMPOSE_FILE="docker-compose.prod.yml"
[ -f "$PROJECT_DIR/$COMPOSE_FILE" ] || { echo "فایل $PROJECT_DIR/$COMPOSE_FILE پیدا نشد"; exit 1; }

cat > /usr/local/bin/carma-watchdog.sh <<EOF
#!/usr/bin/env bash
cd "$PROJECT_DIR" || exit 1
DC="docker compose -f $COMPOSE_FILE --env-file backend/.env"
LOG=/var/log/carma-watchdog.log
STATE=/var/run/carma-watchdog.fail
log(){ echo "\$(date '+%F %T') \$*" >> "\$LOG"; }
exec 9>/var/run/carma-watchdog.lock; flock -n 9 || exit 0

systemctl is-active --quiet docker || { log "docker down -> start"; systemctl start docker; sleep 8; }

for s in db redis api web; do
  if [ -z "\$(\$DC ps --status running -q \$s 2>/dev/null)" ]; then
    log "service \$s not running -> up -d"; \$DC up -d \$s >> "\$LOG" 2>&1
  fi
done

ok_api(){ \$DC exec -T api node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; }
ok_web(){ curl -fsS -m 10 -o /dev/null --resolve $DOMAIN:443:127.0.0.1 https://$DOMAIN/ 2>/dev/null || curl -fsS -m 10 -o /dev/null http://127.0.0.1/ 2>/dev/null; }

bad=""
ok_api || bad="\$bad api"
ok_web || bad="\$bad web"

if [ -n "\$bad" ]; then
  n=\$(( \$(cat "\$STATE" 2>/dev/null || echo 0) + 1 )); echo \$n > "\$STATE"
  log "unhealthy:\$bad (count \$n)"
  if [ \$n -ge 2 ]; then
    for s in \$bad; do log "restarting \$s"; \$DC restart \$s >> "\$LOG" 2>&1; done
    [ \$n -ge 4 ] && { log "still bad -> full up -d --force-recreate"; \$DC up -d --force-recreate >> "\$LOG" 2>&1; echo 0 > "\$STATE"; }
  fi
else
  [ "\$(cat "\$STATE" 2>/dev/null || echo 0)" != 0 ] && log "recovered"
  echo 0 > "\$STATE"
fi

use=\$(df --output=pcent / | tail -1 | tr -dc 0-9)
if [ "\${use:-0}" -ge 90 ]; then log "disk \${use}% -> prune unused images/cache"; docker image prune -af >> "\$LOG" 2>&1; docker builder prune -af >> "\$LOG" 2>&1; fi
[ \$(stat -c %s "\$LOG" 2>/dev/null || echo 0) -gt 5242880 ] && tail -n 2000 "\$LOG" > "\$LOG.tmp" && mv "\$LOG.tmp" "\$LOG"
exit 0
EOF
chmod +x /usr/local/bin/carma-watchdog.sh

cat > /etc/systemd/system/carma-watchdog.service <<EOF
[Unit]
Description=Carma watchdog
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/bin/carma-watchdog.sh
EOF
cat > /etc/systemd/system/carma-watchdog.timer <<EOF
[Unit]
Description=Run Carma watchdog every minute
[Timer]
OnBootSec=60
OnUnitActiveSec=60
AccuracySec=5s
[Install]
WantedBy=timers.target
EOF

systemctl enable docker >/dev/null 2>&1 || true
systemctl daemon-reload
systemctl enable --now carma-watchdog.timer
/usr/local/bin/carma-watchdog.sh; sleep 1
echo "✅ نصب شد. وضعیت:  systemctl list-timers carma-watchdog.timer"
echo "   لاگ:           tail -f /var/log/carma-watchdog.log"
