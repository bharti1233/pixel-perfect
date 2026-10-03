/** Image preparation: resize, background removal (plain backgrounds), trim. */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export async function resizeDataUrl(src: string, max = 1024, type = "image/jpeg"): Promise<string> {
  const img = await loadImage(src);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type, 0.9);
}

/** Removes a roughly uniform background sampled from the image border, flood-filled from edges, then trims. */
export async function cutoutItem(src: string, removeBg = true): Promise<string> {
  const img = await loadImage(src);
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const { width: w, height: h } = c;
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;

  if (removeBg) {
    // average border colour
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    const sample = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      r += d[i]!;
      g += d[i + 1]!;
      b += d[i + 2]!;
      n++;
    };
    for (let x = 0; x < w; x += 4) {
      sample(x, 0);
      sample(x, h - 1);
    }
    for (let y = 0; y < h; y += 4) {
      sample(0, y);
      sample(w - 1, y);
    }
    r /= n;
    g /= n;
    b /= n;
    const T = 60;
    const dist = (i: number) => Math.hypot(d[i]! - r, d[i + 1]! - g, d[i + 2]! - b);
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const p = stack.pop()!;
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4;
      const dd = dist(i);
      if (dd > T) continue;
      d[i + 3] = dd < T * 0.6 ? 0 : Math.round(((dd - T * 0.6) / (T * 0.4)) * 255);
      const x = p % w,
        y = (p / w) | 0;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - w);
      if (y < h - 1) stack.push(p + w);
    }
    ctx.putImageData(im, 0, 0);
  }

  // trim transparent edges
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if ((d[(y * w + x) * 4 + 3] ?? 0) > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return c.toDataURL("image/png");
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out
    .getContext("2d")!
    .drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}
