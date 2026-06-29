#!/usr/bin/env bash
# Run all SQL migrations against a database.
# Usage:
#   ./scripts/migrate.sh local
#   ./scripts/migrate.sh render
#   ./scripts/migrate.sh both

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env at $ENV_FILE"
  exit 1
fi

get_env() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2-)"
  if [[ -z "$value" ]]; then
    echo "Missing $key in $ENV_FILE" >&2
    exit 1
  fi
  printf '%s' "$value"
}

run_migrations() {
  local label="$1"
  local host="$2"
  local port="$3"
  local user="$4"
  local password="$5"
  local db="$6"

  echo "==> Migrating [$label] $user@$host:$port/$db"

  export PGPASSWORD="$password"

  for file in "$ROOT"/sql/migrations/*.sql; do
    echo "    -> $(basename "$file")"
    psql -h "$host" -p "$port" -U "$user" -d "$db" -v ON_ERROR_STOP=1 -f "$file"
  done

  echo "==> Done [$label]"
  echo
}

target="${1:-local}"

case "$target" in
  local)
    run_migrations "local" \
      "$(get_env DB_HOST)" \
      "$(get_env DB_PORT)" \
      "$(get_env DB_USER)" \
      "$(get_env DB_PASSWORD)" \
      "$(get_env DB_NAME)"
    ;;
  render)
    run_migrations "render" \
      "$(get_env RENDER_DB_HOST)" \
      "5432" \
      "$(get_env RENDER_DB_USER)" \
      "$(get_env RENDER_DB_PASSWORD)" \
      "$(get_env RENDER_DB_NAME)"
    ;;
  both)
    run_migrations "local" \
      "$(get_env DB_HOST)" \
      "$(get_env DB_PORT)" \
      "$(get_env DB_USER)" \
      "$(get_env DB_PASSWORD)" \
      "$(get_env DB_NAME)"
    run_migrations "render" \
      "$(get_env RENDER_DB_HOST)" \
      "5432" \
      "$(get_env RENDER_DB_USER)" \
      "$(get_env RENDER_DB_PASSWORD)" \
      "$(get_env RENDER_DB_NAME)"
    ;;
  *)
    echo "Usage: $0 [local|render|both]"
    exit 1
    ;;
esac
