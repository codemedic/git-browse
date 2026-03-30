FROM node:lts-alpine

RUN apk add --no-cache git

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN chmod +x /app/start-container.sh

# Create the internal IDE directory and ensure it is writable by the 'node' user
# This maps to the host's ~/.claude/ide volume.
RUN mkdir -p /home/node/.claude/ide && chown -R node:node /home/node/.claude/ide

WORKDIR /var/www

EXPOSE 8080
EXPOSE 35729
EXPOSE 3001

USER node

ENTRYPOINT ["/app/start-container.sh", ".", "--address", "0.0.0.0", "--port", "8080", "--browser", "false"]
