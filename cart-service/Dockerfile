# --- Build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

# --- Run stage ---
FROM node:20-slim
WORKDIR /app
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
COPY --from=build /app ./
USER appuser
EXPOSE 4003
CMD ["node", "src/index.js"]