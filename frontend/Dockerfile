FROM node:18
WORKDIR /app

# Copy whole context so we can optionally install a provided CA file if present.
# If you have a corporate/root CA, drop it as `frontend/ca.crt` before building.
COPY . /app

# If `ca.crt` exists in the build context, install it into the OS trust store
# and configure npm to use the system CA bundle. Otherwise fall back to a
# temporary (development) workaround that disables strict SSL for npm installs.
RUN if [ -f ./ca.crt ]; then \
			cp ./ca.crt /usr/local/share/ca-certificates/ca.crt && \
			update-ca-certificates && \
			npm config set cafile /etc/ssl/certs/ca-certificates.crt && \
			rm -rf node_modules package-lock.json || true && \
			npm install; \
		else \
			echo "WARNING: ca.crt not found in build context. Using temporary fallback (strict-ssl=false)." && \
			npm config set strict-ssl false && \
			rm -rf node_modules package-lock.json || true && \
			npm install; \
		fi

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
