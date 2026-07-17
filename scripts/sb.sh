#!/usr/bin/env bash
# Supabase CLI wrapper — a projekt-szintű SUPABASE_ACCESS_TOKEN-t a .env-ből
# emeli be, így a CLI a Supbase1978-identitással fut, globális `supabase login`
# nélkül (a gép globális CLI-sessionje más fiókhoz tartozik, azt nem bántjuk).
# Használat: scripts/sb.sh <supabase-parancs>  vagy  npm run sb -- <parancs>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -f "$ROOT/.env" ]; then
  SUPABASE_ACCESS_TOKEN="$(sed -n 's/^[[:space:]]*SUPABASE_ACCESS_TOKEN=//p' "$ROOT/.env" | tail -1)"
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "HIBA: nincs SUPABASE_ACCESS_TOKEN a .env-ben (minta: .env.example)." >&2
  echo "Létrehozás a Supbase1978-fiókkal: https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

exec env SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" supabase --workdir "$ROOT" "$@"
