#!/bin/bash
# Run a command against the CURRENT working tree on sv, in a capped container (never run WebGL/Playwright checks on the csoul host).
# usage: tools/run-on-sv.sh '<command, run inside /work>'          e.g. 'node tools/check.mjs https://walk.csoul.cloud/belvedere/'
#        KEEP=1 tools/run-on-sv.sh '<command>'                     keeps the work dir on sv (prints KEEP:<path>) so you can fetch output files, then `ssh sv rm -rf <path>`
# local dev server inside the container: 'node tools/serve.mjs 8766 >/dev/null & sleep 2; node tools/check.mjs "http://127.0.0.1:8766/viewer/?project=../projects/belvedere/"'
# Needs: ssh sv, docker there. Installs ffmpeg + playwright (version pinned in tools/package.json) in a fresh node:22 container each run (~1-2 min). A full check.mjs takes ~15 min: run it in the background and ALONE.
set -e
cd "$(git rev-parse --show-toplevel)"
D=/tmp/walk-sv-$$; NAME=walk-sv-$$
tar -cf - $(git ls-files -co --exclude-standard; ls tools/_*.mjs 2>/dev/null) 2>/dev/null | ssh sv "rm -rf $D && mkdir -p $D && tar -x -C $D"
if [ -n "$KEEP" ]; then AFTER="echo KEEP:$D"; else AFTER="rm -rf $D"; fi
ssh sv "cat > $D/run.sh <<'EOS'
set -e
(apt-get update -qq && apt-get install -y -qq ffmpeg) >/dev/null 2>&1
cd /work/tools && npm install --no-audit --no-fund >/dev/null 2>&1 && npx playwright install --with-deps chromium >/dev/null 2>&1
cd /work
$1
EOS
docker run --rm --name $NAME --cpus=3 --memory=6g --shm-size=1g -v $D:/work -w /work node:22 bash /work/run.sh; rc=\$?; $AFTER; exit \$rc"
