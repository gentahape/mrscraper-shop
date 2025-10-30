FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 8000

CMD [ "node", "main.js" ]