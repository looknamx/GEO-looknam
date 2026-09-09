import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Remove embedded camera/location/text metadata without changing the image pixels. */
export function stripSceneMetadata(input: Buffer): {
  bytes: Buffer;
  contentType: string;
} {
  if (input[0] === 0xff && input[1] === 0xd8) {
    const chunks = [input.subarray(0, 2)];
    let offset = 2;
    while (offset + 4 <= input.length) {
      if (input[offset] !== 0xff) throw new Error("Invalid JPEG segment");
      const marker = input[offset + 1];
      if (marker === 0xda || marker === 0xd9) {
        chunks.push(input.subarray(offset));
        break;
      }
      const length = input.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > input.length)
        throw new Error("Invalid JPEG length");
      // APP1 contains EXIF/XMP (including GPS), APP13 IPTC, COM free text.
      if (![0xe1, 0xed, 0xfe].includes(marker))
        chunks.push(input.subarray(offset, offset + length + 2));
      offset += length + 2;
    }
    return { bytes: Buffer.concat(chunks), contentType: "image/jpeg" };
  }
  if (
    input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    const chunks = [input.subarray(0, 8)];
    let offset = 8;
    while (offset + 12 <= input.length) {
      const length = input.readUInt32BE(offset),
        kind = input.toString("ascii", offset + 4, offset + 8);
      if (offset + length + 12 > input.length)
        throw new Error("Invalid PNG length");
      if (!["eXIf", "tEXt", "iTXt", "zTXt"].includes(kind))
        chunks.push(input.subarray(offset, offset + length + 12));
      offset += length + 12;
      if (kind === "IEND") break;
    }
    return { bytes: Buffer.concat(chunks), contentType: "image/png" };
  }
  throw new Error("Unsupported scene image format");
}

const cache = new Map<string, ReturnType<typeof stripSceneMetadata>>();
export async function loadScene(path: string) {
  const cached = cache.get(path);
  if (cached) return cached;
  const scene = stripSceneMetadata(await readFile(resolve(path)));
  cache.set(path, scene);
  return scene;
}
