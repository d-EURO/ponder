# deploy-test
FROM node:lts-alpine

RUN mkdir /app && chown -R node:node /app

WORKDIR /app
USER node

ARG COMMIT_HASH=public
ENV COMMIT_HASH=${COMMIT_HASH}

COPY --chown=node . .
RUN yarn install --production --frozen-lockfile

CMD ["sh", "-c", "npx ponder start --schema schema-${COMMIT_HASH}"]
