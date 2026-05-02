#!/bin/bash
# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

# Create the cranis2_test database for isolated test runs.
# This script is mounted as a Docker entrypoint init script.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE cranis2_test OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cranis2_test')\gexec
EOSQL
