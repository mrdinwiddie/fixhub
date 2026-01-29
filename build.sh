#!/bin/bash
set -e

cd "$(dirname "$0")"
ZIP_NAME="fixhub.zip"
FILES="manifest.json popup.html popup.js content.js styles.css fh-icon.png"

rm -f "$ZIP_NAME"

python3 -c "
import zipfile, sys
with zipfile.ZipFile('$ZIP_NAME', 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in '$FILES'.split():
        zf.write(f)
"

echo "Created $ZIP_NAME"
