import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { stripSceneMetadata } from "../services/scenes";
describe("scene privacy and content type", () => {
  it("removes embedded EXIF from a shipped JPEG without changing scan data", async () => {
    const original = await readFile("data/images/003.jpg");
    const scene = stripSceneMetadata(original);
    expect(original.includes(Buffer.from("Exif"))).toBe(true);
    expect(scene.bytes.includes(Buffer.from("Exif"))).toBe(false);
    expect(scene.contentType).toBe("image/jpeg");
    const scan = Buffer.from([0xff, 0xda]);
    expect(scene.bytes.subarray(scene.bytes.indexOf(scan))).toEqual(
      original.subarray(original.indexOf(scan)),
    );
  });
  it("detects actual PNG bytes even when the downloaded filename ends in jpg", async () => {
    const scene = stripSceneMetadata(await readFile("data/images/020.jpg"));
    expect(scene.contentType).toBe("image/png");
    expect(scene.bytes.subarray(1, 4).toString()).toBe("PNG");
  });
  it("rejects unsupported content instead of serving it as an image", () =>
    expect(() => stripSceneMetadata(Buffer.from("<html>"))).toThrow(
      "Unsupported",
    ));
});
