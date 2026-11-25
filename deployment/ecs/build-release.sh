#!/usr/bin/env bash
# Run as the unprivileged labweb user, from a freshly extracted source package.
set -euo pipefail
source_dir=$(cd "$(dirname "$0")/../.." && pwd)
release_dir=${1:?Usage: bash deployment/ecs/build-release.sh /srv/labweb/releases/UNIQUE_ID}
case "$release_dir" in /srv/labweb/releases/*) ;; *) echo "Release must be under /srv/labweb/releases" >&2; exit 1;; esac
[[ ! -e "$release_dir" ]] || { echo "Release already exists" >&2; exit 1; }
[[ $(node -p 'process.versions.node.split(".")[0]') == 24 ]] || { echo "Node.js 24 is required" >&2; exit 1; }
[[ $(uname -s) == Linux && $(uname -m) == x86_64 ]] || { echo "Build on the Linux x64 ECS instance" >&2; exit 1; }
cd "$source_dir"
[[ ! -e .env && ! -e .env.local && ! -e .env.production && ! -e .env.production.local ]] || {
  echo "Keep environment files outside the release source" >&2; exit 1;
}
npm ci --no-audit --no-fund
LABWEB_DEPLOY_TARGET=ecs NEXT_TELEMETRY_DISABLED=1 \
  SUPABASE_URL=http://127.0.0.1:3211 SUPABASE_SERVICE_ROLE_KEY=build-placeholder npm run build
[[ -f .next/standalone/server.js ]] || { echo "Standalone build is missing" >&2; exit 1; }
if find .next/standalone -name '.env*' -print -quit | read -r _; then
  echo "Unexpected env file in traced output" >&2; exit 1
fi
mkdir -p "$release_dir"
cp -a .next/standalone/. "$release_dir/"
mkdir -p "$release_dir/.next"
cp -a .next/static "$release_dir/.next/static"
cp -a public "$release_dir/public"
cp release-manifest.json "$release_dir/"
echo "Built release: $release_dir"
echo "Not activated. Configure /etc/labweb/runtime.env and review QA DNS/access before activation."
