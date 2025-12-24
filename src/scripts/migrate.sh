#!/bin/bash
set -e
source ../.env
for migration in ../migrations/*.sql; do
  echo "Running migration: $migration"
  PGPASSWORD=$DB_PASSWORD \
  psql \
    -h $DB_HOST \
    -p 5432 \
    -U $DB_USER \
    -d $DB_NAME \
    -v ON_ERROR_STOP=1 \
    -f "$migration"
done