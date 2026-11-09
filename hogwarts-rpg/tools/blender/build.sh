#!/bin/sh
# Rebuild dist/assets/models/wizard.glb: Blender export, then animation resampling and meshopt compression.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
RAW=${TMPDIR:-/tmp}/wizard-raw.glb
python "$HERE/export.py" --out "$RAW"            # or: blender -b --python export.py -- --out ...
npx --yes @gltf-transform/cli@4 resample "$RAW" "$RAW.res.glb"
npx --yes @gltf-transform/cli@4 meshopt "$RAW.res.glb" "$HERE/../../dist/assets/models/wizard.glb" --level high
