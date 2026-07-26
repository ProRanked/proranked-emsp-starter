# ── Stage 1: build the SPA ───────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
# Everything the app needs is baked at build time (Vite inlines VITE_*). Pass your key and brand as
# build args. NOTE: a publishable pr_pk_ key is browser-safe by design; never bake a pr_sk_ secret.
ARG VITE_EMSP_API_KEY
ARG VITE_EMSP_BASE_URL=https://api.proranked.com
ARG VITE_BRAND_NAME
ARG VITE_BRAND_TAGLINE
ARG VITE_BRAND_PRIMARY
ARG VITE_BRAND_SECONDARY
ARG VITE_BRAND_LOGO
ENV VITE_EMSP_API_KEY=$VITE_EMSP_API_KEY \
    VITE_EMSP_BASE_URL=$VITE_EMSP_BASE_URL \
    VITE_BRAND_NAME=$VITE_BRAND_NAME \
    VITE_BRAND_TAGLINE=$VITE_BRAND_TAGLINE \
    VITE_BRAND_PRIMARY=$VITE_BRAND_PRIMARY \
    VITE_BRAND_SECONDARY=$VITE_BRAND_SECONDARY \
    VITE_BRAND_LOGO=$VITE_BRAND_LOGO
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
EXPOSE 8080
