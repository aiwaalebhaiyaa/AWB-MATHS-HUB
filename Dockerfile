FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend --omit=dev
COPY backend ./backend
COPY frontend ./frontend
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node","backend/server.js"]
