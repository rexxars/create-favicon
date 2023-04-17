import {createReadStream, existsSync} from 'node:fs'
import {stat, readFile, mkdir, rm} from 'node:fs/promises'
import {join as joinPath} from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {type Server, createServer} from 'node:http'
import {afterAll, beforeAll, describe, expect, test, vi} from 'vitest'
import sharp from 'sharp'
import {createFavicon} from '../src'

let tmpDirNum = 0
const testOutputDir = joinPath(tmpdir(), 'favicons-api-output')
const fixturesPath = joinPath(__dirname, 'fixtures')

function getTmpDir(stub = ''): string {
  return joinPath(testOutputDir, `favicon-${stub ? `${stub}-` : ''}${++tmpDirNum}`)
}

async function hashFile(filePath: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex')
}

describe('api', () => {
  let server: Server

  beforeAll(async () => {
    await mkdir(testOutputDir, {recursive: true})
    await new Promise<void>((resolve, reject) => {
      server = createServer((req, res) => {
        if (req.url === '/mead.svg') {
          res.writeHead(200, 'OK', {'Content-Type': 'image/svg+xml'})
          createReadStream(joinPath(fixturesPath, 'mead.svg')).pipe(res)
          return
        }

        res.writeHead(404, 'Not Found', {'Content-Type': 'text/plain'}).write('Not Found')
        res.end()
      })

      server.on('error', reject)
      server.on('listening', resolve)
      server.listen(27344)
    })
  })

  afterAll(async () => {
    await rm(testOutputDir, {recursive: true})
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  })

  test('should throw an error if no options are specified', async () => {
    // @ts-expect-error -- We're testing the error case
    await expect(() => createFavicon()).rejects.toMatchInlineSnapshot(
      '[Error: No options specified]'
    )
  })

  test('should throw an error if no source file is specified', async () => {
    // @ts-expect-error -- We're testing the error case
    await expect(() => createFavicon({outputDir: getTmpDir()})).rejects.toMatchInlineSnapshot(
      '[Error: No source file specified]'
    )
  })

  test('should throw an error if the source file is not a string, Buffer, or URL (number input)', async () => {
    await expect(() =>
      // @ts-expect-error -- We're testing the error case
      createFavicon({sourceFile: 123, outputDir: getTmpDir()})
    ).rejects.toMatchInlineSnapshot(
      '[Error: Source file must be a string (file path or URL) or a Buffer]'
    )
  })

  test('should throw an error if the source file is not a string, Buffer, or URL (object input)', async () => {
    await expect(() =>
      // @ts-expect-error -- We're testing the error case
      createFavicon({sourceFile: {foo: 'bar'}, outputDir: getTmpDir()})
    ).rejects.toMatchInlineSnapshot(
      '[Error: Source file must be a string (file path or URL) or a Buffer]'
    )
  })

  test('should throw if file path does not exist', async () => {
    await expect(() =>
      createFavicon({sourceFile: 'does-not-exist.png', outputDir: getTmpDir()})
    ).rejects.toThrow(/does-not-exist\.png": ENOENT/)
  })

  test('should throw if url does not return HTTP 200', async () => {
    await expect(() =>
      createFavicon({sourceFile: 'http://localhost:27344', outputDir: getTmpDir()})
    ).rejects.toThrow(
      'Failed fetching image from "http://localhost:27344": Server returned HTTP 404'
    )
  })

  test('should throw if file could not be parsed as image (non-image format)', async () => {
    await expect(() =>
      createFavicon({sourceFile: joinPath(fixturesPath, 'nonImage.svg'), outputDir: getTmpDir()})
    ).rejects.toThrow(/input buffer contains unsupported image format/i)
  })

  test('should throw if file could not be parsed as image (empty buffer)', async () => {
    await expect(() =>
      createFavicon({sourceFile: Buffer.from(''), outputDir: getTmpDir()})
    ).rejects.toThrow(/input buffer is empty/i)
  })

  test('should throw on too small images', async () => {
    await expect(() =>
      createFavicon({sourceFile: joinPath(fixturesPath, 'tooSmall.png'), outputDir: getTmpDir()})
    ).rejects.toThrow(/source image must be at least 512x512 pixels/i)
  })

  test('should warn on non-square images (console warner)', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => null)
    await createFavicon({
      sourceFile: joinPath(fixturesPath, 'nonSquare.svg'),
      outputDir: getTmpDir(),
    })
    expect(spy).toHaveBeenCalledWith(
      '\u001b[93m[warn]\u001b[39m Source image is not square - it is HIGHLY recommended that input image is square'
    )
    spy.mockRestore()
  })

  test('should warn on non-square images (custom warner)', async () => {
    const warn = vi.fn()
    await createFavicon({
      sourceFile: joinPath(fixturesPath, 'nonSquare.svg'),
      outputDir: getTmpDir(),
      warn,
    })
    expect(warn).toHaveBeenCalledWith(
      'Source image is not square - it is HIGHLY recommended that input image is square'
    )
  })

  test('should not warn on non-square images if warnings are disabled', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => null)
    await createFavicon({
      sourceFile: joinPath(fixturesPath, 'nonSquare.svg'),
      warn: false,
      outputDir: getTmpDir(),
    })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  test('should output square images from non-square input', async () => {
    const outputDir = getTmpDir()
    const sourceFile = joinPath(fixturesPath, 'nonSquare.svg')
    await createFavicon({
      sourceFile,
      warn: false,
      outputDir,
    })

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
    const result = await createFavicon({
      sourceFile,
      outputDir,
    })

    expect(await hashFile(joinPath(outputDir, 'icon.svg'))).toBe(await hashFile(sourceFile))

    expect(result.html).toMatchInlineSnapshot(`
      "<link rel=\\"icon\\" href=\\"/favicon.ico\\" sizes=\\"any\\">
      <link rel=\\"icon\\" href=\\"/icon.svg\\" type=\\"image/svg+xml\\">
      <link rel=\\"apple-touch-icon\\" href=\\"/apple-touch-icon.png\\">
      <link rel=\\"manifest\\" href=\\"/manifest.webmanifest\\">"
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

  test('should generate all variations from valid SVG (over HTTP)', async () => {
    const outputDir = getTmpDir('valid')
    const sourceFile = joinPath(fixturesPath, 'mead.svg')
    const result = await createFavicon({
      sourceFile: 'http://localhost:27344/mead.svg',
      outputDir,
    })

    expect(await hashFile(joinPath(outputDir, 'icon.svg'))).toBe(await hashFile(sourceFile))

    expect(result.html).toMatchInlineSnapshot(`
      "<link rel=\\"icon\\" href=\\"/favicon.ico\\" sizes=\\"any\\">
      <link rel=\\"icon\\" href=\\"/icon.svg\\" type=\\"image/svg+xml\\">
      <link rel=\\"apple-touch-icon\\" href=\\"/apple-touch-icon.png\\">
      <link rel=\\"manifest\\" href=\\"/manifest.webmanifest\\">"
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
    const warn = vi.fn()
    const outputDir = getTmpDir('valid-png')
    const sourceFile = joinPath(fixturesPath, 'mead.png')
    const result = await createFavicon({
      sourceFile,
      outputDir,
      warn,
    })

    expect(warn).toHaveBeenCalledWith('Source image is not an SVG - skipping SVG output')

    // eslint-disable-next-line no-sync
    expect(existsSync(joinPath(outputDir, 'icon.svg'))).toBe(false)

    expect(result.html).toMatchInlineSnapshot(`
      "<link rel=\\"icon\\" href=\\"/favicon.ico\\" sizes=\\"any\\">
      <link rel=\\"apple-touch-icon\\" href=\\"/apple-touch-icon.png\\">
      <link rel=\\"manifest\\" href=\\"/manifest.webmanifest\\">"
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
    const result = await createFavicon({
      sourceFile: joinPath(fixturesPath, 'mead.svg'),
      outputDir,
      basePath: '/foo/bar/',
    })

    expect(result.html).toMatchInlineSnapshot(`
      "<link rel=\\"icon\\" href=\\"/foo/bar/favicon.ico\\" sizes=\\"any\\">
      <link rel=\\"icon\\" href=\\"/foo/bar/icon.svg\\" type=\\"image/svg+xml\\">
      <link rel=\\"apple-touch-icon\\" href=\\"/foo/bar/apple-touch-icon.png\\">
      <link rel=\\"manifest\\" href=\\"/foo/bar/manifest.webmanifest\\">"
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
