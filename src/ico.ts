/**
 * Sharp instance to ICO buffer
 * Based on https://github.com/shtse8/sharp-to-ico
 * MIT (c) Weilin Shi
 */
import type {Sharp, OutputInfo} from 'sharp'

const BITMAP_SIZE = 40
const DIRECTORY_SIZE = 16
const HEADER_SIZE = 6

/**
 * Converts a sharp image instance to an ICO buffer, with a single 32x32 image
 *
 * @param img - The base image to use.
 * @returns A Buffer instance containing the ICO file
 * @internal
 */
export async function sharpToIco(img: Sharp): Promise<Buffer> {
  const {data, info} = await img
    .clone()
    .png()
    .resize(32, 32, {kernel: 'cubic'})
    .raw()
    .toBuffer({resolveWithObject: true})

  const header = getHeader()
  let offset = header.length + 16
  const dir = getDir(info, offset)
  const bmpInfoHeader = getBmpInfoHeader(info)
  const dib = getDib(data, info)

  const len = header.length + dir.length + bmpInfoHeader.length + dib.length
  offset += bmpInfoHeader.length + dib.length

  return Buffer.concat([header, dir, bmpInfoHeader, dib], len)
}

// https://en.wikipedia.org/wiki/ICO_(file_format)
function getHeader() {
  const buf = Buffer.alloc(HEADER_SIZE)

  buf.writeUInt16LE(0, 0) // Reserved. Must always be 0.
  buf.writeUInt16LE(1, 2) // Specifies image type: 1 for icon (.ICO) image
  buf.writeUInt16LE(1, 4) // Specifies number of images in the file.

  return buf
}

function getDir(info: OutputInfo, offset: number) {
  const buf = Buffer.alloc(DIRECTORY_SIZE)
  const size = info.size + BITMAP_SIZE

  buf.writeUInt8(info.width, 0) // Specifies image width in pixels.
  buf.writeUInt8(info.height, 1) // Specifies image height in pixels.
  buf.writeUInt8(0, 2) // Should be 0 if the image does not use a color palette.
  buf.writeUInt8(0, 3) // Reserved. Should be 0.
  buf.writeUInt16LE(1, 4) // Specifies color planes. Should be 0 or 1.
  buf.writeUInt16LE(32, 6) // Specifies bits per pixel.
  buf.writeUInt32LE(size, 8) // Specifies the size of the image's data in bytes
  buf.writeUInt32LE(offset, 12) // Specifies the offset of BMP or PNG data from the beginning of the ICO/CUR file

  return buf
}

// https://en.wikipedia.org/wiki/BMP_file_format
function getBmpInfoHeader(info: OutputInfo) {
  const buf = Buffer.alloc(BITMAP_SIZE)
  // https://en.wikipedia.org/wiki/ICO_(file_format)
  // ...Even if the AND mask is not supplied,
  // if the image is in Windows BMP format,
  // the BMP header must still specify a doubled height.
  const height = 64
  const width = 32
  const bpp = 32

  buf.writeUInt32LE(BITMAP_SIZE, 0) // The size of this header (40 bytes)
  buf.writeInt32LE(width, 4) // The bitmap width in pixels (signed integer)
  buf.writeInt32LE(height, 8) // The bitmap height in pixels (signed integer)
  buf.writeUInt16LE(1, 12) // The number of color planes (must be 1)
  buf.writeUInt16LE(bpp, 14) // The number of bits per pixel
  buf.writeUInt32LE(0, 16) // The compression method being used.
  buf.writeUInt32LE(info.size, 20) // The image size.
  buf.writeInt32LE(0, 24) // The horizontal resolution of the image. (signed integer)
  buf.writeInt32LE(0, 28) // The vertical resolution of the image. (signed integer)
  buf.writeUInt32LE(0, 32) // The number of colors in the color palette, or 0 to default to 2n
  buf.writeUInt32LE(0, 36) // The number of important colors used, or 0 when every color is important; generally ignored.

  return buf
}

// https://en.wikipedia.org/wiki/BMP_file_format
// Note that the bitmap data starts with the lower left hand corner of the image.
// blue green red alpha in order
function getDib(data: Buffer, info: OutputInfo) {
  const bpp = 4
  const cols = info.width * bpp
  const rows = info.height * cols
  const end = rows - cols
  const buf = Buffer.alloc(info.size)
  // xor map
  for (let row = 0; row < rows; row += cols) {
    for (let col = 0; col < cols; col += bpp) {
      let pos = row + col
      const r = data.readUInt8(pos)
      const g = data.readUInt8(pos + 1)
      const b = data.readUInt8(pos + 2)
      const a = data.readUInt8(pos + 3)

      pos = end - row + col
      buf.writeUInt8(b, pos)
      buf.writeUInt8(g, pos + 1)
      buf.writeUInt8(r, pos + 2)
      buf.writeUInt8(a, pos + 3)
    }
  }

  return buf
}
