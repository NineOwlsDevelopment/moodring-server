#!/bin/bash
source ../.env
for migration in ../migrations/*.sql; do
  echo "Running migration: $migration"
  PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f "$migration"
done
