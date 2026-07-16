#!/bin/bash
# PostToolUse hook (FEJLESZTESI_DOKUMENTACIO 11.3/3): Edit/Write után azonnali
# tsc --noEmit + eslint az érintett fájlra — a típushiba azonnal derüljön ki.
set -u

input=$(cat)
file=$(printf '%s' "$input" | node -e '
let d = "";
process.stdin.on("data", (c) => (d += c)).on("end", () => {
  try {
    const j = JSON.parse(d);
    process.stdout.write((j.tool_input && j.tool_input.file_path) || "");
  } catch {}
});
')

case "$file" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -d node_modules ] || exit 0   # install előtt nincs mit futtatni

npx react-router typegen >/dev/null 2>&1

ts_out=$(npx tsc --noEmit 2>&1)
if [ $? -ne 0 ]; then
  { echo "TYPECHECK HIBA (tsc --noEmit) — javítsd, mielőtt továbblépsz:"; echo "$ts_out" | head -40; } >&2
  exit 2
fi

lint_out=$(npx eslint "$file" 2>&1)
if [ $? -ne 0 ]; then
  { echo "ESLINT HIBA ($file) — javítsd, mielőtt továbblépsz:"; echo "$lint_out" | head -40; } >&2
  exit 2
fi

exit 0
