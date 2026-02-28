FROM node:22-alpine

WORKDIR /app

# Server dependencies
COPY test-runner/package.json ./
RUN npm install --production

# Server code
COPY test-runner/server.mjs ./

# Test files and dependencies
COPY backend/tests/ ./tests/
RUN cd tests && npm install

EXPOSE 3004

CMD ["node", "server.mjs"]
