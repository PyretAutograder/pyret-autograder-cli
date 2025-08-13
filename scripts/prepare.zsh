#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_PATH=${${(%):-%N}:A}
SCRIPT_DIR=${SCRIPT_PATH:h}
REPO_ROOT=${SCRIPT_DIR:h}

WORK_DIR=${REPO_ROOT}/build/_pyret-work
OUT_DIR=${REPO_ROOT}/build/pyret
PATCH_FILE=${SCRIPT_DIR}/dcic2024-charts.patch

PYRET_DIR=${WORK_DIR}/pyret-lang
CPO_DIR=${WORK_DIR}/code.pyret.org

PYRET_REPO=https://github.com/ironm00n/pyret-lang.git
PYRET_REV=27a74f8dd4bcc762275b487e9d9e90630a25802d

CPO_REPO=https://github.com/ironm00n/code.pyret.org.git
CPO_REV=8460d0a97f0aef62f73128ae26ef2fb54f58f6e8

clone_at_rev() {
  local url=$1 rev=$2 dir=$3
  print -r -- "==> Cloning ${url} @ ${rev} -> ${dir}"
  rm -rf -- "$dir"
  git init -q "$dir"
  git -C "$dir" remote add origin "$url"
  git -C "$dir" fetch --depth 1 origin "$rev"
  git -C "$dir" checkout -q FETCH_HEAD
}

print -r -- "==> Resetting work/output dirs"
rm -rf -- "$WORK_DIR" "$OUT_DIR"
mkdir -p -- "$WORK_DIR" "$OUT_DIR"

clone_at_rev "$PYRET_REPO" "$PYRET_REV" "$PYRET_DIR"
clone_at_rev "$CPO_REPO"   "$CPO_REV"   "$CPO_DIR"

if [[ -f "$PATCH_FILE" ]]; then
  print -r -- "==> Applying patch to CPO: $PATCH_FILE"
  git -C "$CPO_DIR" apply "$PATCH_FILE"
else
  print -r -- "==> Patch not found at $PATCH_FILE (skipping)"
fi

print -r -- "==> npm ci (pyret-lang)"
# npm publish (and npm pack) run all lifecycle scripts in "dry-run" mode.
# If we don’t override that flag, nested npm command only *pretend* to
# install: they print “added ... packages” but write no node_modules tree, so
# later steps fail.
npm --prefix "$PYRET_DIR" ci --ignore-scripts --dry-run=false

print -r -- "==> npm rebuild (native modules like canvas)"
npm --prefix "$PYRET_DIR" rebuild --dry-run=false

print -r -- "==> make phaseA libA"
make -C "$PYRET_DIR" -e SHELL="$(command -v bash)" phaseA libA

mkdir -p -- "$PYRET_DIR/build/cpo"
print -r -- 'import dcic2024 as _' > "$PYRET_DIR/build/compile-dcic.arr"

print -r -- "==> Compile dcic2024 context"
env -C "$PYRET_DIR" node build/phaseA/pyret.jarr \
  -allow-builtin-overrides \
  --builtin-js-dir src/js/trove/ \
  --builtin-arr-dir src/arr/trove/ \
  --builtin-arr-dir "$CPO_DIR/src/web/arr/trove/" \
  --require-config src/scripts/standalone-configA.json \
  --compiled-dir build/cpo/ \
  --build-runnable build/compile-dcic.arr \
  --standalone-file src/js/base/handalone.js \
  --outfile build/cpo/compile-dcic.jarr \
  -no-check-mode

print -r -- "==> Staging -> $OUT_DIR"
cp -r "$PYRET_DIR/build/phaseA/lib-compiled" "$OUT_DIR/"
cp -r "$PYRET_DIR/build/cpo"                 "$OUT_DIR/"

print -r -- "==> Done."
print -r -- "    $OUT_DIR/lib-compiled"
print -r -- "    $OUT_DIR/cpo"
