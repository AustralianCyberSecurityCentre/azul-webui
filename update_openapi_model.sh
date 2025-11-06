#!/bin/bash
set -e

if [ $# -ne 1 ] || [ $1 == '-h' ] || [ $1 == '--help' ]; then
  echo "usage:" 1>&2
  echo "$0 <hostname-of-azul-instance>"
  exit 1
fi

wget https://$1/api/openapi.json -O /tmp/azul-openapi.json

npx openapi-typescript --root-types --root-types-no-schema-prefix --immutable --output src/app/core/api/openapi.d.ts /tmp/azul-openapi.json

npx prettier -w src/app/core/api/openapi.d.ts

rm /tmp/azul-openapi.json

