# # ── Stage 1: build ────────────────────────────────────────────────────────────
# FROM node:20-alpine AS builder

# WORKDIR /app

# # Copy package files and install dependencies
# COPY package.json package-lock.json ./
# RUN npm ci --ignore-scripts

# # Copy source and build
# COPY . .
# RUN npm run build


# # ── Stage 2: serve with Nginx ─────────────────────────────────────────────────
# FROM nginx:1.27-alpine AS runtime

# # Remove default nginx static assets
# RUN rm -rf /usr/share/nginx/html/*

# # Copy built assets from builder
# COPY --from=builder /app/dist /usr/share/nginx/html

# # Nginx config: serve SPA and proxy /api → backend
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# EXPOSE 80

# CMD ["nginx", "-g", "daemon off;"]
# Build:  podman build -t aarav-fe --build-arg VITE_API_URL=http://localhost:5000 .
# Run:    podman run -d --name my-app -p 5000:5000 aarav-fe
#         (-p host:container is required; without it, localhost:5000 will not work.)
#
# Build:  podman build -t aarav-fe --build-arg VITE_API_URL=http://localhost:5000 .
# Run:    podman run -d --name my-app -p 5000:5000 aarav-fe
#         (-p host:container is required; without it, localhost:5000 will not work.)
#
# Build:  podman build -t aarav-fe --build-arg VITE_API_URL=http://localhost:5000 .
# Run:    podman run -d --name my-app -p 5000:5000 aarav-fe
#         (-p host:container is required; without it, localhost:5000 will not work.)
#
# --- Build: install deps and produce static dist/ ---
    FROM node:22-alpine AS builder
    WORKDIR /app
    
    # Install dependencies first (better layer cache)
    COPY package.json package-lock.json ./
    RUN npm ci
    
    COPY . .
    
    # Vite inlines VITE_* at build time only
    ARG VITE_API_URL=http://134.33.132.134/aarav-aegis
    
    ENV VITE_API_URL=$VITE_API_URL
    
    # Path where the SPA is mounted (ingress prefix). Must match trailing slash form, e.g. /aarav-aegis-fe/
    ARG BASE_PATH=/aarav-aegis-fe/
    ENV BASE_PATH=$BASE_PATH
    
    RUN npm run build
    
    # --- Run: static files only (small image, no Node in production) ---
    FROM nginx:1.27-alpine AS runner
    # Copied as a template; envsubst fills ${BACKEND_URL} at container start
    COPY nginx.conf /etc/nginx/conf.d/default.conf.template
    COPY --from=builder /app/dist /usr/share/nginx/html
    
    # Runtime backend URL — override at `docker run` time with -e BACKEND_URL=...
    ENV BACKEND_URL=http://132.122.123.12/aarav-aegis
    
    EXPOSE 5000
    # envsubst substitutes only ${BACKEND_URL}, leaving all other nginx $vars intact
    CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
                                                                                    