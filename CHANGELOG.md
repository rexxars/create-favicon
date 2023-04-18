<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.0.0](https://github.com/rexxars/create-favicon/compare/v1.1.0...v2.0.0) (2023-04-18)

### ⚠ BREAKING CHANGES

- `--output-dir` is no longer a valid flag for CLI command,
  instead pass it as the second positional argument. This eases use with
  `npm create` and similar, since you no longer need args separator (`--`) for the
  basic use case.

### Features

- allow disabling web manifest creation ([a6bba03](https://github.com/rexxars/create-favicon/commit/a6bba03cad9dd997146ce694fb26a84c8fe0aea0))

### Code Refactoring

- make output-dir a positional argument instead of flag ([ea2e1fb](https://github.com/rexxars/create-favicon/commit/ea2e1fb0c5d45738771725fd635f01135392e959))

## [1.1.0](https://github.com/rexxars/create-favicon/compare/v1.0.0...v1.1.0) (2023-04-17)

### Features

- do not overwrite files by default, add `--overwrite` flag ([63ec230](https://github.com/rexxars/create-favicon/commit/63ec23022e5909f34b9cf103fac21e06054e9613))
