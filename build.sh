#!/bin/bash
set -e

ZIP_NAME="fixhub.zip"

rm -f "$ZIP_NAME"
7z a "$ZIP_NAME" manifest.json popup.html popup.js content.js styles.css fh-icon.png

echo "Created $ZIP_NAME"
