#!/bin/bash
set -e

source ../.env

for migration in ../migrations/*.sql; do
  echo "Running migration: $migration"
  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_SSL" \
    --set=sslmode="$DB_SSLMODE" \
    -f "$migration"
done