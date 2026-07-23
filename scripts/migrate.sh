#!/usr/bin/env bash
# Run all SQL migrations against a database.
# Usage:
#   ./scripts/migrate.sh local     # uses DB_* from .env
#   ./scripts/migrate.sh railway   # same as local (DB_* → Railway proxy)
#   ./scripts/migrate.sh render    # uses RENDER_DB_* from .env
#   ./scripts/migrate.sh both      # local/railway + render
#
# Only the new coupon_name migration:
#   ./scripts/migrate.sh railway 011

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
  local only="${7:-}"

  echo "==> Migrating [$label] $user@$host:$port/$db"

  export PGPASSWORD="$password"

  if [[ -n "$only" ]]; then
    local file
    file="$(ls "$ROOT"/sql/migrations/"${only}"*.sql 2>/dev/null | head -1 || true)"
    if [[ -z "$file" ]]; then
      echo "No migration matching: ${only}" >&2
      exit 1
    fi
    echo "    -> $(basename "$file")"
    psql -h "$host" -p "$port" -U "$user" -d "$db" -v ON_ERROR_STOP=1 -f "$file"
  else
    for file in "$ROOT"/sql/migrations/*.sql; do
      echo "    -> $(basename "$file")"
      psql -h "$host" -p "$port" -U "$user" -d "$db" -v ON_ERROR_STOP=1 -f "$file"
    done
  fi

  echo "==> Done [$label]"
  echo
}

target="${1:-local}"
only_migration="${2:-}"

case "$target" in
  local|railway)
    run_migrations "$target" \
      "$(get_env DB_HOST)" \
      "$(get_env DB_PORT)" \
      "$(get_env DB_USER)" \
      "$(get_env DB_PASSWORD)" \
      "$(get_env DB_NAME)" \
      "$only_migration"
    ;;
  render)
    run_migrations "render" \
      "$(get_env RENDER_DB_HOST)" \
      "5432" \
      "$(get_env RENDER_DB_USER)" \
      "$(get_env RENDER_DB_PASSWORD)" \
      "$(get_env RENDER_DB_NAME)" \
      "$only_migration"
    ;;
  both)
    run_migrations "railway" \
      "$(get_env DB_HOST)" \
      "$(get_env DB_PORT)" \
      "$(get_env DB_USER)" \
      "$(get_env DB_PASSWORD)" \
      "$(get_env DB_NAME)" \
      "$only_migration"
    run_migrations "render" \
      "$(get_env RENDER_DB_HOST)" \
      "5432" \
      "$(get_env RENDER_DB_USER)" \
      "$(get_env RENDER_DB_PASSWORD)" \
      "$(get_env RENDER_DB_NAME)" \
      "$only_migration"
    ;;
  *)
    echo "Usage: $0 [local|railway|render|both] [migration-prefix]"
    echo "Examples:"
    echo "  $0 railway"
    echo "  $0 railway 011"
    exit 1
    ;;
esac
