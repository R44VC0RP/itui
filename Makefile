SHELL := /bin/bash

.PHONY: help format lint test build imsg clean web-build web-dev web-serve

help:
	@printf "%s\n" \
		"make format  - swift format in-place" \
		"make lint    - swift format lint + swiftlint" \
		"make test    - sync version, patch deps, run swift test" \
		"make build   - universal release build into bin/" \
		"make imsg    - clean rebuild + run debug binary (ARGS=...)" \
		"make web-build - build web/ and copy it into Sources/imsg/Resources/web/" \
		"make web-dev   - run the Vite dev server for web/" \
		"make web-serve - build web + debug imsg, then serve the bundled app" \
		"make clean   - swift package clean"

format:
	swift format --in-place --recursive Sources Tests

lint:
	swift format lint --recursive Sources Tests
	swiftlint

test:
	scripts/generate-version.sh
	swift package resolve
	scripts/patch-deps.sh
	swift test

build:
	scripts/generate-version.sh
	swift package resolve
	scripts/patch-deps.sh
	scripts/build-universal.sh

imsg:
	scripts/generate-version.sh
	swift package resolve
	scripts/patch-deps.sh
	swift package clean
	swift build -c debug --product imsg
	./.build/debug/imsg $(ARGS)

web-build:
	scripts/build-web.sh

web-dev:
	scripts/dev-web.sh

web-serve:
	scripts/build-web.sh
	swift build -c debug --product imsg
	./.build/debug/imsg serve --host 127.0.0.1 --port 13197

clean:
	swift package clean
