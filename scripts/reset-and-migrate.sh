#!/usr/bin/env bash
# Drop and recreate the public schema, then run migrations.
# Usage:
#   ./scripts/reset-and-migrate.sh local
#   ./scripts/reset-and-migrate.sh render

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

reset_schema() {
  local label="$1"
  local host="$2"
  local port="$3"
  local user="$4"
  local password="$5"
  local db="$6"

  echo "==> Resetting [$label] $user@$host:$port/$db"
  export PGPASSWORD="$password"
  psql -h "$host" -p "$port" -U "$user" -d "$db" -v ON_ERROR_STOP=1 <<SQL
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
GRANT ALL ON SCHEMA public TO "$user";
SQL
}

target="${1:-local}"

case "$target" in
  local)
    reset_schema "local" \
      "$(get_env DB_HOST)" \
      "$(get_env DB_PORT)" \
      "$(get_env DB_USER)" \
      "$(get_env DB_PASSWORD)" \
      "$(get_env DB_NAME)"
    ;;
  render)
    reset_schema "render" \
      "$(get_env RENDER_DB_HOST)" \
      "5432" \
      "$(get_env RENDER_DB_USER)" \
      "$(get_env RENDER_DB_PASSWORD)" \
      "$(get_env RENDER_DB_NAME)"
    ;;
  *)
    echo "Usage: $0 [local|render]"
    exit 1
    ;;
esac

"$ROOT/scripts/migrate.sh" "$target"
