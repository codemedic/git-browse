FROM node:lts-alpine

RUN npm install -g markserv

COPY src/dark.css /tmp/dark.css
RUN cat /tmp/dark.css >> /usr/local/lib/node_modules/markserv/lib/templates/markserv.css

COPY src/theme-toggle.js /usr/local/lib/node_modules/markserv/lib/templates/theme-toggle.js
COPY src/mermaid-init.js /usr/local/lib/node_modules/markserv/lib/templates/mermaid-init.js
RUN sed -i 's|</head>|<script src="{markserv}templates/theme-toggle.js"></script>\n<script type="module" src="{markserv}templates/mermaid-init.js"></script>\n</head>|' \
    /usr/local/lib/node_modules/markserv/lib/templates/markdown.html

COPY src/patch-server.js /tmp/patch-server.js
RUN node /tmp/patch-server.js

WORKDIR /var/www

EXPOSE 8080

ENTRYPOINT ["markserv", ".", "--address", "0.0.0.0", "--port", "8080"]
