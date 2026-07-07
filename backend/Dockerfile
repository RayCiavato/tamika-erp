FROM node:20-alpine
WORKDIR /app

# 1. Instalamos las librerias que Prisma necesita en Alpine Linux
RUN apk add --no-cache openssl libc6-compat

COPY package*.json ./
RUN npm install
COPY . .

# 2. Generamos el cliente de Prisma internamente
RUN npx prisma generate

EXPOSE 5000
CMD ["npm", "start"]
