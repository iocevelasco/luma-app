#!/bin/bash

# Generate RSA key pair for JWT signing (RS256)
# Usage: ./generate-jwt-keys.sh

echo "Generating RSA key pair for JWT..."

# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key from private key
openssl rsa -in private.pem -pubout -out public.pem

echo "✅ Keys generated:"
echo "  - private.pem (JWT_PRIVATE_KEY_PEM)"
echo "  - public.pem (JWT_PUBLIC_KEY_PEM)"
echo ""
echo "⚠️  Add these to your .env file:"
echo "JWT_PRIVATE_KEY_PEM=\"$(cat private.pem | tr '\n' '\\n')\""
echo "JWT_PUBLIC_KEY_PEM=\"$(cat public.pem | tr '\n' '\\n')\""
echo ""
echo "⚠️  Keep private.pem secure and never commit it to version control!"

