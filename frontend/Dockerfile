FROM node:20-alpine
WORKDIR /app
ARG API_INTERNAL_URL=http://backend:5000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
