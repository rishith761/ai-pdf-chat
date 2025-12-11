FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm install --production --no-audit --no-fund

# Copy application source
COPY . .

# Create a non-root user and take ownership of the app directory
RUN addgroup -S app && adduser -S -G app app && chown -R app:app /app

# Switch to the non-root user
USER app

# Expose port and set environment defaults
EXPOSE 3000
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the server
CMD ["node", "server/index.js"]
