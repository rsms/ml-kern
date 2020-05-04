#!/bin/bash -e
cd "$(dirname "$0")"

# BUILD_DIR is the intermediate product output directory.
# The contents of this dir is deleted when -O is set, so make sure this is
# not a directory shared with other, non-build product files.
BUILD_DIR=docs/build-dev

# TMP_BUILD_DIR is a build directory for temporary, intermediate products.
TMP_BUILD_DIR=.build

# DIST_DIR is the distribution output directory, used when -dist is set.
# The contents of this dir is deleted when -dist is set, so make sure this is
# not a directory shared with other, non-build product files.
DIST_DIR=docs/build

# INDEX_HTML_DIR is a directory of the index.html file which loads main.js.
# When -w is set, this directory is served with a HTTP server on HTTP_PORT.
# When -dist is set, "?v=\w" in INDEX_HTML_DIR/index.html is rewritten to
# "git rev-parse HEAD".
INDEX_HTML_DIR=docs

# HTTP_PORT is a TCP/IP port for the web server to bind to.
# Only used when -w is set.
HTTP_PORT=9185

OPT_HELP=false
OPT_WATCH=false
OPT_OPT=false
OPT_DIST=false


# parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
  -h*|--h*)
    OPT_HELP=true
    shift
    ;;
  -w*|--w*)
    OPT_WATCH=true
    shift
    ;;
  -O)
    OPT_OPT=true
    shift
    ;;
  -dist|--dist)
    OPT_DIST=true
    OPT_OPT=true
    shift
    ;;
  *)
    echo "$0: Unknown option $1" >&2
    OPT_HELP=true
    shift
    ;;
  esac
done
if $OPT_DIST && $OPT_WATCH; then
  echo "$0: options -w and -dist are not compatible." >&2
  OPT_HELP=true
fi
if $OPT_HELP; then
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -h   Show help."
  echo "  -O   Build optimized product."
  echo "  -w   Watch source files for changes and rebuild incrementally."
  exit 1
fi

# check node_modules
if ! [ -d node_modules/esbuild ]; then
  echo "npm install"
  npm install
fi

if $OPT_DIST; then
  rm -rf "$BUILD_DIR"
fi

mkdir -p "$BUILD_DIR" "$TMP_BUILD_DIR"
BUILD_DIR_REL=$BUILD_DIR
pushd "$BUILD_DIR" >/dev/null
BUILD_DIR=$PWD
popd >/dev/null

WATCHFILE=$TMP_BUILD_DIR/build.sh.watch

function fn_build_go {
  GO_SRCDIR=src
  pushd "$GO_SRCDIR" >/dev/null
  echo "go build $GO_SRCDIR -> $BUILD_DIR_REL/main.wasm"
  # tinygo build -o "$BUILD_DIR/main.wasm" -target wasm -no-debug .
  GOOS=js GOARCH=wasm go build -o "$BUILD_DIR/main.wasm"
  popd >/dev/null
}

function fn_build_js {
  if $OPT_OPT; then
    esbuild --platform=node --define:DEBUG=false --sourcemap --minify \
      "--outfile=$TMP_BUILD_DIR/boot.js" src/boot.js
  else
    esbuild --platform=node --define:DEBUG=true  --sourcemap \
      "--outfile=$TMP_BUILD_DIR/boot.js" src/boot.js
  fi
  if $OPT_OPT; then
    esbuild --platform=node --define:DEBUG=false --sourcemap --minify --bundle \
      "--external:@tensorflow/tfjs-node" \
      "--outfile=$TMP_BUILD_DIR/main.js" src/main.js
  else
    esbuild --platform=node --define:DEBUG=true --sourcemap --bundle \
      "--external:@tensorflow/tfjs-node" \
      "--outfile=$TMP_BUILD_DIR/main.js" src/main.js
  fi
  node misc/jsmerge.js "$BUILD_DIR/main.js" \
    "$TMP_BUILD_DIR/boot.js" \
    "$TMP_BUILD_DIR/main.js"
}

function fn_watch_go {
  while true; do
    fswatch -1 -l 0.2 -r -E --exclude='.+' --include='\.go$' src >/dev/null
    if ! [ -f "$WATCHFILE" ] || [ "$(cat "$WATCHFILE")" != "y" ]; then break; fi
    set +e ; fn_build_go ; set -e
  done
}

function fn_watch_js {
  while true; do
    fswatch -1 -l 0.2 -r -E --exclude='.+' --include='\.js$' src >/dev/null
    if ! [ -f "$WATCHFILE" ] || [ "$(cat "$WATCHFILE")" != "y" ]; then break; fi
    set +e ; fn_build_js ; set -e
  done
}

# fn_build_go &
fn_build_js &

if $OPT_WATCH; then
  echo y > "$WATCHFILE"

  # make sure we can ctrl-c in the while loop
  function fn_stop {
    echo n > "$WATCHFILE"
    exit
  }
  trap fn_stop SIGINT

  # make sure background processes are killed when this script is stopped
  pids=()
  function fn_cleanup {
    set +e
    for pid in "${pids[@]}"; do
      kill $pid 2>/dev/null
      wait $pid
      kill -9 $pid 2>/dev/null
      echo n > "$WATCHFILE"
    done
    set -e
  }
  trap fn_cleanup EXIT

  # wait for initial build
  wait

  # start web server
  if (which serve-http >/dev/null); then
    serve-http -p $HTTP_PORT -quiet "$INDEX_HTML_DIR" &
    pids+=( $! )
    echo "Web server listening at http://localhost:$HTTP_PORT/"
  else
    echo "Tip: Install serve-http to have a web server run."
    echo "     npm install -g serve-http"
  fi

  echo "Watching source files for changes..."

  # fn_watch_go &
  # pids+=( $! )

  fn_watch_js
else
  wait

  if $OPT_DIST; then
    rm -rf "$DIST_DIR"
    cp -a "$BUILD_DIR" "$DIST_DIR"

    # patch "?v=VERSION" INDEX_HTML_DIR/index.html
    VERSION=$(git rev-parse HEAD)
    sed -E 's/\?v=[a-f0-9]+/?v='$VERSION'/g' \
      "$INDEX_HTML_DIR/index.html" > "$INDEX_HTML_DIR/.index.html.tmp"
    mv -f "$INDEX_HTML_DIR/.index.html.tmp" "$INDEX_HTML_DIR/index.html"
  fi

fi
