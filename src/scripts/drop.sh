#!/bin/bash
source ../.env

echo "Dropping all database tables..."

# Drop all tables dynamically by querying the database schema
# This approach automatically discovers all tables and drops them in the correct order
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF

-- =====================================================
-- DROP ALL TABLES DYNAMICALLY
-- =====================================================
-- This script automatically discovers and drops all tables
-- in the public schema, handling foreign key dependencies
-- with CASCADE

DO \$\$
DECLARE
    r RECORD;
    drop_cmd TEXT;
BEGIN
    -- Drop all tables in the public schema
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    ) LOOP
        drop_cmd := 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        EXECUTE drop_cmd;
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;
END \$\$;

-- =====================================================
-- DROP VIEWS
-- =====================================================
DO \$\$
DECLARE
    r RECORD;
    drop_cmd TEXT;
BEGIN
    FOR r IN (
        SELECT viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    ) LOOP
        drop_cmd := 'DROP VIEW IF EXISTS ' || quote_ident(r.viewname) || ' CASCADE';
        EXECUTE drop_cmd;
        RAISE NOTICE 'Dropped view: %', r.viewname;
    END LOOP;
END \$\$;

-- =====================================================
-- DROP FUNCTIONS
-- =====================================================
DO \$\$
DECLARE
    r RECORD;
    drop_cmd TEXT;
BEGIN
    FOR r IN (
        SELECT routine_name, routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_type IN ('FUNCTION', 'PROCEDURE')
    ) LOOP
        drop_cmd := 'DROP ' || r.routine_type || ' IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
        EXECUTE drop_cmd;
        RAISE NOTICE 'Dropped %: %', r.routine_type, r.routine_name;
    END LOOP;
END \$\$;

-- =====================================================
-- DROP TRIGGERS
-- =====================================================
DO \$\$
DECLARE
    r RECORD;
    drop_cmd TEXT;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        drop_cmd := 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || 
                   ' ON ' || quote_ident(r.event_object_table) || ' CASCADE';
        EXECUTE drop_cmd;
        RAISE NOTICE 'Dropped trigger: % on %', r.trigger_name, r.event_object_table;
    END LOOP;
END \$\$;

EOF

echo "All tables, views, functions, and triggers dropped successfully!"
