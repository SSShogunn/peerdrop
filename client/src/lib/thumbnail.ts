const MAX_DIMENSION = 96;
const JPEG_QUALITY = 0.6;

export async function createImagePreview(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/")) return undefined;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return undefined;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return undefined;
  }
}
