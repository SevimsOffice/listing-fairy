import jsPDF from "jspdf";

export type EnhanceOptions = {
  targetDPI?: number;
  scaleFactor?: number;
  jpegQuality?: number;
  smoothing?: "low" | "medium" | "high";
  targetWidth?: number;
  targetHeight?: number;
};

export type EnhancedFile = { blob: Blob; url: string; name: string };

export type EnhancedExport = {
  png: EnhancedFile;
  jpg: EnhancedFile;
  pdf: EnhancedFile;
  width: number;
  height: number;
  dpi: number;
};

export function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      res(dims);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      rej(e);
    };
    img.src = url;
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      res(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      rej(e);
    };
    img.src = url;
  });
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function configureCtx(
  ctx: CanvasRenderingContext2D,
  smoothing: "low" | "medium" | "high",
) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = smoothing;
}

/**
 * Multi-step upscale: doubling each step until close to target, then a final
 * resize to the exact target dimensions. Produces sharper results than a
 * single drawImage from source to final size.
 */
function multiStepUpscale(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
  smoothing: "low" | "medium" | "high",
): HTMLCanvasElement {
  let curW = srcW;
  let curH = srcH;
  let curCanvas = makeCanvas(curW, curH);
  let curCtx = curCanvas.getContext("2d")!;
  configureCtx(curCtx, smoothing);
  curCtx.drawImage(source, 0, 0, curW, curH);

  // Double up while we're under half of target
  while (curW * 2 <= targetW && curH * 2 <= targetH) {
    const nextW = curW * 2;
    const nextH = curH * 2;
    const next = makeCanvas(nextW, nextH);
    const nctx = next.getContext("2d")!;
    configureCtx(nctx, smoothing);
    nctx.drawImage(curCanvas, 0, 0, nextW, nextH);
    curCanvas.width = 0;
    curCanvas.height = 0;
    curCanvas = next;
    curCtx = nctx;
    curW = nextW;
    curH = nextH;
  }

  if (curW !== targetW || curH !== targetH) {
    const final = makeCanvas(targetW, targetH);
    const fctx = final.getContext("2d")!;
    configureCtx(fctx, smoothing);
    fctx.drawImage(curCanvas, 0, 0, targetW, targetH);
    curCanvas.width = 0;
    curCanvas.height = 0;
    curCanvas = final;
  }
  return curCanvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  q?: number,
): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("toBlob failed"))),
      type,
      q,
    ),
  );
}

// ─── PNG pHYs chunk injection ────────────────────────────────────
// CRC32 implementation for PNG chunks
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function writeUint32BE(view: DataView, offset: number, val: number) {
  view.setUint32(offset, val >>> 0, false);
}

/**
 * Inject a pHYs chunk specifying pixels-per-meter for given DPI.
 * pHYs goes after IHDR.
 */
async function embedPngDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Validate PNG signature
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) return blob;

  const ppm = Math.round(dpi * 39.3701); // pixels per meter
  // Build pHYs chunk: length(4) + "pHYs"(4) + data(9) + crc(4)
  const dataLen = 9;
  const chunk = new Uint8Array(4 + 4 + dataLen + 4);
  const dv = new DataView(chunk.buffer);
  writeUint32BE(dv, 0, dataLen);
  chunk[4] = 0x70;
  chunk[5] = 0x48;
  chunk[6] = 0x59;
  chunk[7] = 0x73;
  writeUint32BE(dv, 8, ppm); // x ppm
  writeUint32BE(dv, 12, ppm); // y ppm
  chunk[16] = 1; // unit: meter
  const crc = crc32(chunk.subarray(4, 4 + 4 + dataLen));
  writeUint32BE(dv, 4 + 4 + dataLen, crc);

  // IHDR is first chunk after signature: offset 8, length(4)+type(4)+13+crc(4) = 25
  // Insert pHYs right after IHDR (offset 8 + 25 = 33)
  const insertAt = 8 + 4 + 4 + 13 + 4;
  // Remove any existing pHYs
  const out = new Uint8Array(buf.length + chunk.length);
  out.set(buf.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(buf.subarray(insertAt), insertAt + chunk.length);
  return new Blob([out], { type: "image/png" });
}

// ─── JPEG JFIF DPI patching ──────────────────────────────────────
async function embedJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return blob;

  // Look for APP0 (JFIF) marker FF E0
  if (buf[2] === 0xff && buf[3] === 0xe0) {
    // JFIF header: at offset 2 we have FF E0, length(2), "JFIF\0"(5), version(2), units(1), Xdensity(2), Ydensity(2)
    // units offset: 2 + 2 + 2 + 5 + 2 = 13
    const unitsOffset = 13;
    const xOffset = 14;
    const yOffset = 16;
    const out = new Uint8Array(buf);
    out[unitsOffset] = 1; // 1 = dots per inch
    out[xOffset] = (dpi >> 8) & 0xff;
    out[xOffset + 1] = dpi & 0xff;
    out[yOffset] = (dpi >> 8) & 0xff;
    out[yOffset + 1] = dpi & 0xff;
    return new Blob([out], { type: "image/jpeg" });
  }

  // No JFIF — inject one right after SOI
  const app0 = new Uint8Array(20);
  app0[0] = 0xff;
  app0[1] = 0xe0;
  app0[2] = 0x00;
  app0[3] = 0x10; // length = 16
  app0[4] = 0x4a; // J
  app0[5] = 0x46; // F
  app0[6] = 0x49; // I
  app0[7] = 0x46; // F
  app0[8] = 0x00;
  app0[9] = 0x01; // version 1.1
  app0[10] = 0x01;
  app0[11] = 0x01; // units = inch
  app0[12] = (dpi >> 8) & 0xff;
  app0[13] = dpi & 0xff;
  app0[14] = (dpi >> 8) & 0xff;
  app0[15] = dpi & 0xff;
  app0[16] = 0;
  app0[17] = 0;
  app0[18] = 0;
  app0[19] = 0;
  const out = new Uint8Array(buf.length + app0.length);
  out.set(buf.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(buf.subarray(2), 2 + app0.length);
  return new Blob([out], { type: "image/jpeg" });
}

export async function enhanceAndExport(
  file: File,
  options: EnhanceOptions = {},
): Promise<EnhancedExport> {
  const {
    targetDPI = 300,
    scaleFactor = 3.125,
    jpegQuality = 0.97,
    smoothing = "high",
    targetWidth,
    targetHeight,
  } = options;

  const img = await loadImage(file);
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  let finalW = targetWidth ?? Math.round(srcW * scaleFactor);
  let finalH = targetHeight ?? Math.round(srcH * scaleFactor);

  // Clamp to safe canvas limits. Browsers cap canvas dimensions (~16384px per
  // edge) and total area; exceeding them makes drawImage/toBlob silently fail
  // (toBlob returns null → "toBlob failed"). Scale the target down uniformly so
  // a large source still produces valid output instead of aborting generation.
  const MAX_EDGE = 12000;
  const MAX_AREA = 100_000_000; // ~100MP
  const edgeScale = Math.min(1, MAX_EDGE / finalW, MAX_EDGE / finalH);
  const areaScale = Math.min(1, Math.sqrt(MAX_AREA / (finalW * finalH)));
  const clamp = Math.min(edgeScale, areaScale);
  if (clamp < 1) {
    finalW = Math.max(1, Math.round(finalW * clamp));
    finalH = Math.max(1, Math.round(finalH * clamp));
  }

  const upscaled = multiStepUpscale(img, srcW, srcH, finalW, finalH, smoothing);

  // Export PNG
  const pngRaw = await canvasToBlob(upscaled, "image/png");
  const pngBlob = await embedPngDpi(pngRaw, targetDPI);

  // Export JPG (white background to avoid transparency artifacts)
  const jpgCanvas = makeCanvas(finalW, finalH);
  const jctx = jpgCanvas.getContext("2d")!;
  jctx.fillStyle = "#ffffff";
  jctx.fillRect(0, 0, finalW, finalH);
  jctx.drawImage(upscaled, 0, 0);
  const jpgRaw = await canvasToBlob(jpgCanvas, "image/jpeg", jpegQuality);
  const jpgBlob = await embedJpegDpi(jpgRaw, targetDPI);
  jpgCanvas.width = 0;
  jpgCanvas.height = 0;

  // Build PDF at correct physical size
  const widthMM = (finalW / targetDPI) * 25.4;
  const heightMM = (finalH / targetDPI) * 25.4;
  const pdf = new jsPDF({
    unit: "mm",
    format: [widthMM, heightMM],
    orientation: widthMM >= heightMM ? "landscape" : "portrait",
  });
  // Use the JPG dataURL (smaller than PNG) for PDF embedding
  const jpgDataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("FileReader failed"));
    r.readAsDataURL(jpgBlob);
  });
  pdf.addImage(jpgDataUrl, "JPEG", 0, 0, widthMM, heightMM);
  const pdfBlob = pdf.output("blob");

  // Release upscaled canvas
  upscaled.width = 0;
  upscaled.height = 0;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "artwork";
  return {
    png: {
      blob: pngBlob,
      url: URL.createObjectURL(pngBlob),
      name: `${baseName}-${finalW}x${finalH}-${targetDPI}dpi.png`,
    },
    jpg: {
      blob: jpgBlob,
      url: URL.createObjectURL(jpgBlob),
      name: `${baseName}-${finalW}x${finalH}-${targetDPI}dpi.jpg`,
    },
    pdf: {
      blob: pdfBlob,
      url: URL.createObjectURL(pdfBlob),
      name: `${baseName}-print-ready.pdf`,
    },
    width: finalW,
    height: finalH,
    dpi: targetDPI,
  };
}
