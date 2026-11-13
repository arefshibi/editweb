#!/bin/bash
# استفاده: ./sms-status.sh 25219565 25219566
cd /root/ccc/carmaa || exit 1
[ $# -eq 0 ] && { echo "recId بدهید"; exit 1; }
URL=$(grep '^MELIPAYAMAK_OTP_URL=' backend/.env | cut -d= -f2- | tr -d "\"'")
TOKEN=${URL##*/}
IDS=$(echo "$@" | tr ' ' ',')
curl -s -X POST "https://console.melipayamak.com/api/receive/status/$TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"recIds\":[$IDS]}"
echo
