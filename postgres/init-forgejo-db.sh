#!/bin/bash
set -e

# Use environment variables passed from docker-compose.yml
FORGEJO_USER="${FORGEJO_DB_USER:-forgejo}"
FORGEJO_PASS="${FORGEJO_DB_PASSWD:-forgejo_dev_2026}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${FORGEJO_USER}') THEN
            CREATE USER ${FORGEJO_USER} WITH PASSWORD '${FORGEJO_PASS}';
        END IF;
    END
    \$\$;

    SELECT 'CREATE DATABASE forgejo OWNER ${FORGEJO_USER}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'forgejo')\gexec
EOSQL
