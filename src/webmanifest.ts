/**
 * Generates a web manifest file containing the two icons usually needed (192 and 512).
 *
 * @param basePath - The base path where the icons are located. Defaults to `/`.
 * @returns A JSON-serialized web manifest
 * @public
 */
export function generateWebManifest(basePath: string = '/'): string {
  const base = basePath.endsWith('/') ? basePath.replace(/\/+$/, '') : basePath
  const manifest = {
    icons: [
      {src: `${base}/icon-192.png`, type: 'image/png', sizes: '192x192'},
      {src: `${base}/icon-512.png`, type: 'image/png', sizes: '512x512'},
    ],
  }
  return JSON.stringify(manifest, null, 2)
}
