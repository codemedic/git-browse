FROM node:lts-alpine

RUN apk add --no-cache git
# Allow git to read repos mounted from the host (different UID → dubious ownership)
RUN git config --global --add safe.directory /var/www
RUN npm install -g markserv

COPY src/dark.css /tmp/dark.css
RUN cat /tmp/dark.css >> /usr/local/lib/node_modules/markserv/lib/templates/markserv.css

COPY src/theme-toggle.js /usr/local/lib/node_modules/markserv/lib/templates/theme-toggle.js
COPY src/mermaid-init.js /usr/local/lib/node_modules/markserv/lib/templates/mermaid-init.js
COPY src/filetree.js /usr/local/lib/node_modules/markserv/lib/templates/filetree.js
COPY src/offline-check.js /usr/local/lib/node_modules/markserv/lib/templates/offline-check.js
COPY src/preview-toggle.js /usr/local/lib/node_modules/markserv/lib/templates/preview-toggle.js
COPY src/git-state.js /usr/local/lib/node_modules/markserv/lib/templates/git-state.js
RUN sed -i 's|</head>|<script src="{markserv}templates/theme-toggle.js"></script>\n<script type="module" src="{markserv}templates/mermaid-init.js"></script>\n<script src="{markserv}templates/filetree.js"></script>\n<script src="{markserv}templates/offline-check.js"></script>\n<script src="{markserv}templates/preview-toggle.js"></script>\n<script src="{markserv}templates/git-state.js"></script>\n</head>|' \
    /usr/local/lib/node_modules/markserv/lib/templates/markdown.html
RUN sed -i 's|</head>|<script src="{markserv}templates/theme-toggle.js"></script>\n<script src="{markserv}templates/filetree.js"></script>\n<script src="{markserv}templates/offline-check.js"></script>\n<script src="{markserv}templates/git-state.js"></script>\n</head>|' \
    /usr/local/lib/node_modules/markserv/lib/templates/directory.html

COPY src/patches/ /tmp/patches/
COPY src/patch-server.js /tmp/patch-server.js
RUN node /tmp/patch-server.js

WORKDIR /var/www

EXPOSE 8080
EXPOSE 35729

ENTRYPOINT ["sh", "-c", "exec markserv . --address 0.0.0.0 --port 8080 --livereloadport ${LIVERELOAD_PORT:-35729}"]
