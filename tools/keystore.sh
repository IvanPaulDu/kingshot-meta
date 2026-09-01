#!/usr/bin/env bash
# Crea el almacén de claves con el que se firma el APK de publicación y el
# android/keystore.properties que lee app/build.gradle.
#
#   tools/keystore.sh [contraseña]
#
# Ni el .jks ni el .properties se versionan: son secretos. Guarda una copia
# fuera del repositorio, porque perder la clave impide actualizar la app.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE="$ROOT/android/upload.jks"
PROPS="$ROOT/android/keystore.properties"
PASS="${1:-cambiaesta}"
ALIAS="upload"

if [ -f "$STORE" ]; then
  echo "Ya existe $STORE — no se toca."
else
  keytool -genkeypair -v \
    -keystore "$STORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Vaiven, OU=Apps, O=Vaiven, L=, S=, C=MX"
  echo "Creado $STORE"
fi

cat > "$PROPS" <<PROPERTIES
storeFile=upload.jks
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
PROPERTIES
echo "Creado $PROPS"
