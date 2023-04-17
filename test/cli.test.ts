import {createReadStream, existsSync, mkdirSync} from 'node:fs'
import {stat, readFile, mkdir, rm} from 'node:fs/promises'
import {join as joinPath} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {type Server, createServer} from 'node:http'
import {SpawnSyncOptions, SpawnSyncReturns, spawnSync} from 'node:child_process'
import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import sharp from 'sharp'

let tmpDirNum = 0
const testOutputDir = joinPath(tmpdir(), 'favicons-cli-output')
const fixturesPath = joinPath(__dirname, 'fixtures')
const cliPath = joinPath(__dirname, '..', 'bin', 'create-favicon.cjs')

function createFavicon(
  args: string[] = [],
  options: SpawnSyncOptions = {}
): SpawnSyncReturns<string> {
  return spawnSync(cliPath, args, {...options, encoding: 'utf8'})
}

function getTmpDir(stub = ''): string {
  const tmpDir = joinPath(testOutputDir, `favicon-${stub ? `${stub}-` : ''}${++tmpDirNum}`)
  mkdirSync(tmpDir, {recursive: true})
  return tmpDir
}

async function hashFile(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex')
}

describe('cli', () => {
  let server: Server

  beforeAll(async () => {
    await mkdir(testOutputDir, {recursive: true})
    await new Promise<void>((resolve, reject) => {
      server = createServer((req, res) => {
        if (req.url === '/mead.svg') {
          createReadStream(joinPath(fixturesPath, 'mead.svg')).pipe(res)
          return
        }

        res.writeHead(404, 'Not Found', {'Content-Type': 'text/plain'}).write('Not Found')
        res.end()
      })

      server.on('error', reject)
      server.on('listening', resolve)
      server.listen(27345)
    })
  })

  afterAll(async () => {
    await rm(testOutputDir, {recursive: true})
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test('should show help if no options are passed', () => {
    const result = createFavicon([], {cwd: getTmpDir()})
    expect(result.stdout).toMatch('Generate favicons from a source image')
    expect(result.stdout).toContain('--output-dir <dir>')
    expect(result.status).toBe(1)
  })

  test('should throw if file path does not exist', () => {
    const result = createFavicon(['does-not-exist.png'], {cwd: getTmpDir()})
    expect(result.stderr).toContain('Could not read file')
    expect(result.stderr).toContain('does-not-exist.png')
    expect(result.status).toBe(1)
  })

  // @todo vitest hangs on HTTP requests for some reason
  test.skip('should throw if url does not return HTTP 200', () => {
    const result = createFavicon(['http://localhost:27345'], {cwd: getTmpDir()})
    expect(result.stderr).toContain('Failed fetching image from "http://localhost:27345"')
    expect(result.stderr).toContain('Server returned HTTP 404')
    expect(result.status).toBe(1)
  })

  test('should throw if file could not be parsed as image (non-image format)', () => {
    const result = createFavicon([joinPath(fixturesPath, 'nonImage.svg')], {cwd: getTmpDir()})
    expect(result.stderr).toMatch(/input buffer contains unsupported image format/i)
    expect(result.status).toBe(1)
  })

  test('should throw if file could not be parsed as image (empty file)', () => {
    const result = createFavicon([joinPath(fixturesPath, 'empty.svg')], {cwd: getTmpDir()})
    expect(result.stderr).toMatch(/input buffer is empty/i)
    expect(result.status).toBe(1)
  })

  test('should throw on too small images', () => {
    const result = createFavicon([joinPath(fixturesPath, 'tooSmall.png')], {cwd: getTmpDir()})
    expect(result.stderr).toMatch(/source image must be at least 512x512 pixels/i)
    expect(result.status).toBe(1)
  })

  test('should warn on non-square images (console warner)', () => {
    const result = createFavicon([joinPath(fixturesPath, 'nonSquare.svg')], {cwd: getTmpDir()})
    expect(result.stderr).toMatch(/source image is not square/i)
    expect(result.status).toBe(0)
  })

  test('should not warn on non-square images if warnings are disabled', () => {
    const result = createFavicon([joinPath(fixturesPath, 'nonSquare.svg'), '--no-warn'], {
      cwd: getTmpDir(),
    })
    expect(result.stderr).not.toMatch(/source image is not square/i)
    expect(result.status).toBe(0)
  })

  test('should output square images from non-square input', async () => {
    const outputDir = getTmpDir()
    const sourceFile = joinPath(fixturesPath, 'nonSquare.svg')

    const result = createFavicon([sourceFile, '--output-dir', outputDir])
    expect(result.status).toBe(0)

    expect(await hashFile(joinPath(outputDir, 'icon.svg'))).toBe(await hashFile(sourceFile))

    expect(await sharp(joinPath(outputDir, 'apple-touch-icon.png')).metadata()).toMatchObject({
      width: 180,
      height: 180,
      format: 'png',
      hasAlpha: true,
    })

    expect(await sharp(joinPath(outputDir, 'icon-512.png')).metadata()).toMatchObject({
      width: 512,
      height: 512,
      format: 'png',
      hasAlpha: true,
    })

    expect(await sharp(joinPath(outputDir, 'icon-192.png')).metadata()).toMatchObject({
      width: 192,
      height: 192,
      format: 'png',
      hasAlpha: true,
    })

    expect((await stat(joinPath(outputDir, 'favicon.ico'))).size).toBeGreaterThan(0)
    expect((await stat(joinPath(outputDir, 'favicon.ico'))).size).toBeGreaterThan(0)
  })

  test('should generate all variations from valid SVG', async () => {
    const outputDir = getTmpDir('valid')
    const sourceFile = joinPath(fixturesPath, 'mead.svg')
    const result = await createFavicon([sourceFile, '--output-dir', outputDir])

    expect(await hashFile(joinPath(outputDir, 'icon.svg'))).toBe(await hashFile(sourceFile))

    expect(result.stdout).toMatchInlineSnapshot(`
      "<link rel=\\"icon\\" href=\\"/favicon.ico\\" sizes=\\"any\\">
      <link rel=\\"icon\\" href=\\"/icon.svg\\" type=\\"image/svg+xml\\">
      <link rel=\\"apple-touch-icon\\" href=\\"/apple-touch-icon.png\\">
      <link rel=\\"manifest\\" href=\\"/manifest.webmanifest\\">
      "
    `)

    expect(await sharp(joinPath(outputDir, 'apple-touch-icon.png')).metadata()).toMatchObject({
      width: 180,
      height: 180,
      format: 'png',
      hasAlpha: true,
    })

    expect(await sharp(joinPath(outputDir, 'icon-512.png')).metadata()).toMatchObject({
      width: 512,
      height: 512,
      format: 'png',
      hasAlpha: true,
    })

    expect(await sharp(joinPath(outputDir, 'icon-192.png')).metadata()).toMatchObject({
      width: 192,
      height: 192,
      format: 'png',
      hasAlpha: true,
    })

    expect((await stat(joinPath(outputDir, 'favicon.ico'))).size).toBeGreaterThan(0)

    expect(JSON.parse(await readFile(joinPath(outputDir, 'manifest.webmanifest'), 'utf8')))
      .toMatchInlineSnapshot(`
    {
      "icons": [
        {
          "sizes": "192x192",
          "src": "/icon-192.png",
          "type": "image/png",
        },
        {
          "sizes": "512x512",
          "src": "/icon-512.png",
          "type": "image/png",
        },
      ],
    }
    `)
  })

  test('should generate all variations except SVG from PNG input, prints warning', async () => {
    const outputDir = getTmpDir('valid-png')
    const sourceFile = joinPath(fixturesPath, 'mead.png')
    const result = await createFavicon([sourceFile, '--output-dir', outputDir])

    expect(result.stderr).toMatch(/Source image is not an SVG - skipping SVG output/i)

    // eslint-disable-next-line no-sync
    expect(existsSync(joinPath(outputDir, 'icon.svg'))).toBe(false)

    expect(result.stdout).toMatchInlineSnapshot(`
      "<link rel=\\"icon\\" href=\\"/favicon.ico\\" sizes=\\"any\\">
      <link rel=\\"apple-touch-icon\\" href=\\"/apple-touch-icon.png\\">
      <link rel=\\"manifest\\" href=\\"/manifest.webmanifest\\">
      "
    `)

    expect(await sharp(joinPath(outputDir, 'apple-touch-icon.png')).metadata()).toMatchObject({
      width: 180,
      height: 180,
      format: 'png',
      hasAlpha: true,
    })

    expect(await sharp(joinPath(outputDir, 'icon-512.png')).metadata()).toMatchObject({
      width: 512,
      height: 512,
      format: 'png',
      hasAlpha: true,
    })

    expect(await sharp(joinPath(outputDir, 'icon-192.png')).metadata()).toMatchObject({
      width: 192,
      height: 192,
      format: 'png',
      hasAlpha: true,
    })

    expect((await stat(joinPath(outputDir, 'favicon.ico'))).size).toBeGreaterThan(0)

    expect(JSON.parse(await readFile(joinPath(outputDir, 'manifest.webmanifest'), 'utf8')))
      .toMatchInlineSnapshot(`
      {
        "icons": [
          {
            "sizes": "192x192",
            "src": "/icon-192.png",
            "type": "image/png",
          },
          {
            "sizes": "512x512",
            "src": "/icon-512.png",
            "type": "image/png",
          },
        ],
      }
    `)
  })

  test('should be able to specify custom base path', async () => {
    const outputDir = getTmpDir('custom-basepath')
    const result = await createFavicon([
      joinPath(fixturesPath, 'mead.svg'),
      '--output-dir',
      outputDir,
      '--base-path',
      '/foo/bar/',
    ])

    expect(result.stdout).toMatchInlineSnapshot(`
      "<link rel=\\"icon\\" href=\\"/foo/bar/favicon.ico\\" sizes=\\"any\\">
      <link rel=\\"icon\\" href=\\"/foo/bar/icon.svg\\" type=\\"image/svg+xml\\">
      <link rel=\\"apple-touch-icon\\" href=\\"/foo/bar/apple-touch-icon.png\\">
      <link rel=\\"manifest\\" href=\\"/foo/bar/manifest.webmanifest\\">
      "
    `)

    expect(JSON.parse(await readFile(joinPath(outputDir, 'manifest.webmanifest'), 'utf8')))
      .toMatchInlineSnapshot(`
      {
        "icons": [
          {
            "sizes": "192x192",
            "src": "/foo/bar/icon-192.png",
            "type": "image/png",
          },
          {
            "sizes": "512x512",
            "src": "/foo/bar/icon-512.png",
            "type": "image/png",
          },
        ],
      }
    `)
  })
})
