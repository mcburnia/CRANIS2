# Copyright © 2023–2026 Andrew (Andi) MCBURNIE. All rights reserved.
# SPDX-License-Identifier: LicenseRef-Cranis2-Proprietary
#
# This file is part of CRANIS2 — a personally-owned, personally-funded
# software product. Unauthorised copying, modification, distribution,
# or commercial use is prohibited. For licence enquiries:
# andi@mcburnie.com

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3004
CMD ["node", "server.js"]
