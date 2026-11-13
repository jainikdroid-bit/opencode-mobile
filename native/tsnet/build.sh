#!/bin/sh
# Builds android/app/libs/tsnetbridge.aar. Needs Go, gomobile/gobind and the Android NDK.
# Built from a copy in a neutral directory so no local path ends up inside the library.
set -e
TOP=$(cd "$(dirname "$0")/../.." && pwd)
if [ -d /c ]; then B=${TSNET_BUILD:-/c/ocb}; else B=${TSNET_BUILD:-/tmp/ocb}; fi
rm -rf "$B/tsnet"; mkdir -p "$B/tsnet" "$B/tmp"; cp "$TOP"/native/tsnet/*.go "$TOP"/native/tsnet/go.mod "$TOP"/native/tsnet/go.sum "$B/tsnet/"; cd "$B/tsnet"
export TMP="$B/tmp" TEMP="$B/tmp" TMPDIR="$B/tmp" GOTOOLCHAIN=auto GOFLAGS=-mod=mod
export PATH="$PATH:$HOME/go/bin"
: "${ANDROID_HOME:?set ANDROID_HOME}"; : "${ANDROID_NDK_HOME:?set ANDROID_NDK_HOME}"
mkdir -p "$TOP/android/app/libs"
gomobile bind -trimpath -target=android/arm64,android/arm,android/amd64 -androidapi 24 -ldflags="-s -w -extldflags=-Wl,-z,max-page-size=16384" -o "$TOP/android/app/libs/tsnetbridge.aar" .
echo OK
