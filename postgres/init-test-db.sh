#!/bin/bash
# Create the cranis2_test database for isolated test runs.
# This script is mounted as a Docker entrypoint init script.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE cranis2_test OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cranis2_test')\gexec
EOSQL
