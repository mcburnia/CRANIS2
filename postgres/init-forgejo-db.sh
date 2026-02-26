#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'forgejo') THEN
            CREATE USER forgejo WITH PASSWORD 'forgejo_dev_2026';
        END IF;
    END
    \$\$;

    SELECT 'CREATE DATABASE forgejo OWNER forgejo'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'forgejo')\gexec
EOSQL
