FROM node:22-alpine

# bash: tests in security/{key-rotation,hybrid-signing} and integration/system-scripts
#       run `bash -n script.sh` for syntax-check; alpine ships with ash only.
# docker-cli: integration/system-scripts dry-runs invoke `docker version` etc.
#             (compose mounts /var/run/docker.sock so the CLI can talk to the host daemon).
RUN apk add --no-cache bash docker-cli

# ── Test-runner shell at /app ──────────────────────────────────────────
WORKDIR /app
COPY test-runner/package.json ./
RUN npm install --production
COPY test-runner/server.mjs ./

# ── Backend layout at /backend (mirrors the host monorepo so PROJECT_ROOT
#    in tests = path.resolve(__dirname, '../../..') resolves to '/' and
#    /backend, /docs, /scripts all exist as siblings). ─────────────────
COPY backend/ /backend/
RUN cd /backend && npm install --production
RUN cd /backend/tests && npm install

# Sibling dirs / files needed by tests that read fixture files at PROJECT_ROOT.
# (security/hardening.test.ts checks compose, nginx, postgres, welcome configs.)
COPY docs/ /docs/
COPY scripts/ /scripts/
COPY postgres/ /postgres/
COPY nginx/ /nginx/
COPY docker-compose.yml /docker-compose.yml
COPY welcome/config.js /welcome/config.js

EXPOSE 3004

CMD ["node", "server.mjs"]
