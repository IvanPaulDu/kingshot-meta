#!/usr/bin/env bash
# Crea el almacén de claves para firmar el APK de release y el
# android/keystore.properties que lee app/build.gradle.
#
#   tools/make-keystore.sh [contraseña]
#
# Ni el .jks ni el .properties se versionan (ver .gitignore): son secretos.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STORE="$ROOT/android/selektor-release.jks"
PROPS="$ROOT/android/keystore.properties"
PASS="${1:-selektor}"
ALIAS="selektor"

if [ -f "$STORE" ]; then
  echo "Ya existe $STORE — no se toca."
else
  keytool -genkeypair -v \
    -keystore "$STORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=Selektor, OU=Games, O=coreanodecalle, L=, S=, C=MX"
  echo "Creado $STORE"
fi

cat > "$PROPS" <<EOF
storeFile=selektor-release.jks
storePassword=$PASS
keyAlias=$ALIAS
keyPassword=$PASS
EOF
echo "Creado $PROPS"
