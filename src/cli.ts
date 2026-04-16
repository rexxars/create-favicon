#!/usr/bin/env node
import {readFileSync} from 'node:fs'
import {parseArgs} from 'node:util'
import {createFavicon} from './favicon.js'

function getPackageVersion(): string {
  const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  const pkg: unknown = JSON.parse(raw)
  if (
    typeof pkg === 'object' &&
    pkg !== null &&
    'version' in pkg &&
    typeof pkg.version === 'string'
  ) {
    return pkg.version
  }
  return 'unknown'
}

const version = getPackageVersion()

const helpText = `create-favicon v${version}

Usage:
  create-favicon <source-file> [output-dir]

Generate favicons from a source image

Options:
  --overwrite          Overwrite existing files
  --base-path <path>   Base path for printed HTML and web manifest (default: /)
  --no-manifest        Skip outputting a webmanifest
  --no-warn            Disable warnings
  -h, --help           Show this help message
  -v, --version        Show version number

Examples:
  create-favicon source.svg
  create-favicon https://example.com/source.png ./icons`

try {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
      overwrite: {type: 'boolean', default: false},
      'base-path': {type: 'string', default: '/'},
      'no-manifest': {type: 'boolean', default: false},
      'no-warn': {type: 'boolean', default: false},
      help: {type: 'boolean', short: 'h', default: false},
      version: {type: 'boolean', short: 'v', default: false},
    },
  })

  if (values.help) {
    console.log(helpText)
    process.exit(0)
  }

  if (values.version) {
    console.log(version)
    process.exit(0)
  }

  const [sourceFile, outputDir] = positionals
  if (!sourceFile) {
    console.log(helpText)
    process.exit(1)
  }

  const result = await createFavicon({
    sourceFile,
    outputDir,
    basePath: values['base-path'],
    overwrite: values.overwrite,
    warn: values['no-warn'] ? false : undefined,
    manifest: values['no-manifest'] ? false : undefined,
  })

  console.log(result.html)
} catch (err) {
  console.error(err)
  process.exit(1)
}
