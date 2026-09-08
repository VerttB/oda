#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
OUTPUT_DIR="$ROOT_DIR/backups/db"
FORMAT="plain"
DOCKER_CONTAINER=""

usage() {
  cat <<'USAGE'
Uso:
  scripts/backup-db.sh
  scripts/backup-db.sh --output-dir backups/db
  scripts/backup-db.sh --format custom
  scripts/backup-db.sh --docker-container nome_do_container

Variaveis lidas:
  DATABASE_URL

Ou, se DATABASE_URL nao existir:
  POSTGRES_HOST
  POSTGRES_PORT
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_DB

Opcoes:
  --env-file <arquivo>     Arquivo .env para carregar. Padrao: .env na raiz.
  --output-dir <pasta>     Pasta de destino. Padrao: backups/db.
  --format <plain|custom>  plain gera .sql; custom gera .dump para pg_restore.
  --docker-container <nome> Usa pg_dump dentro de um container Docker.
  --help                   Mostra esta ajuda.
USAGE
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0

  while IFS='=' read -r key value || [[ -n "${key:-}" ]]; do
    [[ -n "${key:-}" ]] || continue
    [[ "$key" =~ ^[[:space:]]*# ]] && continue

    key="$(printf '%s' "$key" | xargs)"
    case "$key" in
      DATABASE_URL|POSTGRES_HOST|POSTGRES_PORT|POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)
        value="$(printf '%s' "$value" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
        export "$key=$value"
        ;;
    esac
  done < "$file"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --format)
      FORMAT="$2"
      shift 2
      ;;
    --docker-container)
      DOCKER_CONTAINER="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[backup-db] Opcao desconhecida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$FORMAT" in
  custom)
    EXTENSION="dump"
    PG_FORMAT_ARGS=(-Fc)
    ;;
  plain)
    EXTENSION="sql"
    PG_FORMAT_ARGS=(-Fp)
    ;;
  *)
    echo "[backup-db] Formato invalido: $FORMAT. Use custom ou plain." >&2
    exit 1
    ;;
esac

load_env_file "$ENV_FILE"

if [[ -n "$DOCKER_CONTAINER" ]] && ! command -v docker >/dev/null 2>&1; then
  echo "[backup-db] docker nao encontrado no PATH." >&2
  exit 1
fi

if [[ -z "$DOCKER_CONTAINER" ]] && ! command -v pg_dump >/dev/null 2>&1; then
  echo "[backup-db] pg_dump nao encontrado no PATH." >&2
  echo "[backup-db] Instale o cliente do PostgreSQL, adicione o binario ao PATH ou use --docker-container." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

TIMESTAMP="$(date +"%Y_%m_%d_%H_%M")"
BACKUP_FILE="$OUTPUT_DIR/backup_${TIMESTAMP}.${EXTENSION}"

if [[ -n "$DOCKER_CONTAINER" ]]; then
  : "${POSTGRES_USER:?POSTGRES_USER nao configurado}"
  : "${POSTGRES_DB:?POSTGRES_DB nao configurado}"

  echo "[backup-db] Gerando backup via Docker container '${DOCKER_CONTAINER}' em: $BACKUP_FILE"
  docker exec \
    -e PGPASSWORD="${POSTGRES_PASSWORD:-}" \
    "$DOCKER_CONTAINER" \
    pg_dump \
      "${PG_FORMAT_ARGS[@]}" \
      --no-owner \
      --no-privileges \
      --username "$POSTGRES_USER" \
      --dbname "$POSTGRES_DB" \
    > "$BACKUP_FILE"
elif [[ -n "${DATABASE_URL:-}" ]]; then
  echo "[backup-db] Gerando backup via DATABASE_URL em: $BACKUP_FILE"
  pg_dump "${PG_FORMAT_ARGS[@]}" --no-owner --no-privileges --file "$BACKUP_FILE" "$DATABASE_URL"
else
  : "${POSTGRES_HOST:?POSTGRES_HOST nao configurado}"
  : "${POSTGRES_PORT:?POSTGRES_PORT nao configurado}"
  : "${POSTGRES_USER:?POSTGRES_USER nao configurado}"
  : "${POSTGRES_DB:?POSTGRES_DB nao configurado}"

  echo "[backup-db] Gerando backup de ${POSTGRES_DB} em ${POSTGRES_HOST}:${POSTGRES_PORT}: $BACKUP_FILE"
  PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
    "${PG_FORMAT_ARGS[@]}" \
    --no-owner \
    --no-privileges \
    --host "$POSTGRES_HOST" \
    --port "$POSTGRES_PORT" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --file "$BACKUP_FILE"
fi

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "[backup-db] Backup gerado, mas o arquivo esta vazio: $BACKUP_FILE" >&2
  exit 1
fi

echo "[backup-db] Backup concluido: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
