FROM node:lts-alpine

RUN apk add --no-cache git
# Allow git to read repos mounted from the host (different UID → dubious ownership)
RUN git config --global --add safe.directory /var/www

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

WORKDIR /var/www

EXPOSE 8080
EXPOSE 35729

ENTRYPOINT ["sh", "-c", "exec node /app/src/server.js . --address 0.0.0.0 --port 8080 --livereloadport ${LIVERELOAD_PORT:-35729} --browser false"]
