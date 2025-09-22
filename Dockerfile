FROM node:lts-alpine

RUN mkdir /app && chown -R node:node /app

WORKDIR /app
USER node

COPY --chown=node . .
RUN npm install

CMD ["npm", "run", "api:dev"]
