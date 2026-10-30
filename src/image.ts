import { nearestColor } from './engine/colors';

const MAX_SIDE = 900;

/**
 * Shrinks a photo and re-encodes it as JPEG. Drawing through a canvas also
 * drops the photo's hidden metadata, including GPS location.
 * Returns the image and a best guess at the garment's main colour.
 */
export async function processPhoto(file: File): Promise<{ dataUrl: string; color: string }> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

  // The garment is usually in the middle of the shot, the background at the edges.
  const sample = document.createElement('canvas');
  sample.width = sample.height = 40;
  const sctx = sample.getContext('2d', { willReadFrequently: true })!;
  sctx.drawImage(canvas, w * 0.25, h * 0.25, w * 0.5, h * 0.5, 0, 0, 40, 40);
  const px = sctx.getImageData(0, 0, 40, 40).data;
  const pixels: [number, number, number][] = [];
  for (let i = 0; i < px.length; i += 4) pixels.push([px[i], px[i + 1], px[i + 2]]);

  return { dataUrl, color: nearestColor(dominant(pixels)).id };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file couldn’t be opened as a photo.'));
    };
    img.src = url;
  });
}

/** Largest cluster of a small k-means over the pixels. */
function dominant(pixels: [number, number, number][], k = 3): [number, number, number] {
  let centers = [0, Math.floor(pixels.length / 2), pixels.length - 1].slice(0, k).map((i) => [...pixels[i]]);
  let assign = new Array(pixels.length).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    assign = pixels.map((p) => {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, ci) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = ci;
        }
      });
      return best;
    });
    centers = centers.map((c, ci) => {
      const members = pixels.filter((_, i) => assign[i] === ci);
      if (!members.length) return c;
      return [0, 1, 2].map((ch) => members.reduce((s, m) => s + m[ch], 0) / members.length);
    });
  }
  const counts = centers.map((_, ci) => assign.filter((a) => a === ci).length);
  const c = centers[counts.indexOf(Math.max(...counts))];
  return [c[0], c[1], c[2]];
}
