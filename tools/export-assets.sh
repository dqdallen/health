#!/usr/bin/env bash
# Run from project root. Requires ImageMagick; ordinary preview/build uses committed exports.
set -euo pipefail
convert design/source-assets/guardian-v1.png -resize 512x512 -strip preview/assets/guardian-v1.png
convert design/source-assets/lantern-v1.png -resize 256x256 -strip preview/assets/lantern-v1.png
convert design/source-assets/island-v1.png -resize 768x512 -strip preview/assets/island-v1.png
cp preview/assets/*.png miniprogram/assets/
