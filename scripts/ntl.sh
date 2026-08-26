#!/usr/bin/env bash
# Netlify CLI wrapper — a projekt-szintű NETLIFY_AUTH_TOKEN-t a .env-ből emeli
# be, így a CLI a Supbase1978-identitással fut, globális `netlify login` nélkül.
#
# MIÉRT KELL: a gépre telepített netlify CLI az `endre.sztellik@gmail.com` /
# `EndRemek` csapatba van bejelentkezve, a `supperz` projekt viszont a
# `supbase1978` („Supbase") fiókban él. Azzal a tokennel a CLI OLVASSA a
# projektet (a getSite trimmelt választ ad: nincs `domain_aliases`, `ssl`,
# `account_id`), de MINDEN ÍRÁS `JSONHTTPError: Not Found`-dal bukik — ami
# elsőre elgépelt azonosítónak látszik, pedig jogosultsági hiba.
# Ugyanaz a csapda, mint a Supabase CLI-nél (ld. `sb.sh`): ha valami „nincs
# ott" vagy „üres" a Netlify-on, előbb a FIÓKRA gyanakodj, ne a beállításra.
#
# Használat: bash scripts/ntl.sh <netlify-parancs>
# TITKOT NE `npm run`-on át adj: az npm kiírja a teljes parancssort.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# A .env-beli token az ELSŐDLEGES, felülírja az örökölt env-változót.
if [ -f "$ROOT/.env" ]; then
  ENV_TOKEN="$(sed -n 's/^[[:space:]]*NETLIFY_AUTH_TOKEN=//p' "$ROOT/.env" | tail -1 | tr -d '[:space:]')"
  if [ -n "$ENV_TOKEN" ]; then
    NETLIFY_AUTH_TOKEN="$ENV_TOKEN"
  fi
fi

if [ -z "${NETLIFY_AUTH_TOKEN:-}" ]; then
  echo "HIBA: nincs NETLIFY_AUTH_TOKEN a .env-ben (minta: .env.example)." >&2
  echo "Létrehozás a Supbase1978-fiókkal bejelentkezve:" >&2
  echo "  https://app.netlify.com/user/applications#personal-access-tokens" >&2
  exit 1
fi

exec env NETLIFY_AUTH_TOKEN="$NETLIFY_AUTH_TOKEN" netlify "$@"
