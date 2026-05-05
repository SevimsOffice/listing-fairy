import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { MOCKUP_TEMPLATES, type MockupTemplate } from "@/lib/mockupTemplates";

export type GeneratorStep =
  | "idle"
  | "converting"
  | "generating-mockups"
  | "done"
  | "error";

type Mockup = { templateId: string; templateName: string; url: string; blob: Blob };

type Assets = {
  pngBlob: Blob;
  jpgBlob: Blob;
  pdfBlob: Blob;
  originalName: string;
  mockups: Mockup[];
};

const MOCKUP_W = 1200;
const MOCKUP_H = 1200;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    // Don't revoke immediately — caller might draw later. Revoke after a tick.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, q = 0.92): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, q),
  );
}

async function renderMockup(art: HTMLImageElement, t: MockupTemplate): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = MOCKUP_W;
  canvas.height = MOCKUP_H;
  const ctx = canvas.getContext("2d")!;

  // Background — parse simple linear-gradient or fallback
  const grad = ctx.createLinearGradient(0, 0, 0, MOCKUP_H);
  const stops = parseGradient(t.background);
  stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, MOCKUP_W, MOCKUP_H);

  // Subtle floor shadow line
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(0, MOCKUP_H * 0.6 - 1, MOCKUP_W, 2);

  // Frame
  const fx = t.frame.x * MOCKUP_W;
  const fy = t.frame.y * MOCKUP_H;
  const fw = t.frame.width * MOCKUP_W;
  const fh = t.frame.height * MOCKUP_H;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = t.frameColor;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.restore();

  // Mat
  const matInset = Math.min(fw, fh) * 0.06;
  ctx.fillStyle = t.matColor;
  ctx.fillRect(fx + matInset, fy + matInset, fw - matInset * 2, fh - matInset * 2);

  // Artwork (preserve aspect, contain)
  const artInset = Math.min(fw, fh) * 0.12;
  const ax = fx + artInset;
  const ay = fy + artInset;
  const aw = fw - artInset * 2;
  const ah = fh - artInset * 2;
  const ratio = Math.min(aw / art.width, ah / art.height);
  const dw = art.width * ratio;
  const dh = art.height * ratio;
  ctx.drawImage(art, ax + (aw - dw) / 2, ay + (ah - dh) / 2, dw, dh);

  return canvasToBlob(canvas, "image/jpeg", 0.9);
}

function parseGradient(css: string): Array<[number, string]> {
  // Very small parser for "linear-gradient(180deg, #aaa 0%, #bbb 60%, ...)"
  const m = css.match(/linear-gradient\(([^)]+)\)/);
  if (!m) return [[0, "#eee"], [1, "#ccc"]];
  const parts = m[1].split(",").map((s) => s.trim());
  const stops: Array<[number, string]> = [];
  for (const p of parts) {
    const sm = p.match(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+(\d+(?:\.\d+)?)%/);
    if (sm) stops.push([parseFloat(sm[2]) / 100, sm[1]]);
  }
  if (stops.length < 2) return [[0, "#eee"], [1, "#ccc"]];
  return stops;
}

async function imageToFormats(file: File) {
  const art = await fileToImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = art.naturalWidth;
  canvas.height = art.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(art, 0, 0);

  const pngBlob = await canvasToBlob(canvas, "image/png");

  // JPG needs white background
  const jpgCanvas = document.createElement("canvas");
  jpgCanvas.width = canvas.width;
  jpgCanvas.height = canvas.height;
  const jctx = jpgCanvas.getContext("2d")!;
  jctx.fillStyle = "#ffffff";
  jctx.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height);
  jctx.drawImage(art, 0, 0);
  const jpgBlob = await canvasToBlob(jpgCanvas, "image/jpeg", 0.95);

  // PDF — A4 portrait, fit image
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const ratio = Math.min(
    (pageW - margin * 2) / canvas.width,
    (pageH - margin * 2) / canvas.height,
  );
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(
    jpgCanvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    (pageW - w) / 2,
    (pageH - h) / 2,
    w,
    h,
  );
  const pdfBlob = pdf.output("blob");

  return { art, pngBlob, jpgBlob, pdfBlob };
}

export function useListingGenerator() {
  const [step, setStep] = useState<GeneratorStep>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);

  const reset = useCallback(() => {
    if (assets) {
      assets.mockups.forEach((m) => URL.revokeObjectURL(m.url));
    }
    setStep("idle");
    setProgress(0);
    setError(null);
    setAssets(null);
  }, [assets]);

  const generate = useCallback(async (file: File) => {
    try {
      setError(null);
      setAssets(null);
      setStep("converting");
      setProgress(10);

      const { art, pngBlob, jpgBlob, pdfBlob } = await imageToFormats(file);
      setProgress(40);

      setStep("generating-mockups");
      const mockups: Mockup[] = [];
      for (let i = 0; i < MOCKUP_TEMPLATES.length; i++) {
        const t = MOCKUP_TEMPLATES[i];
        const blob = await renderMockup(art, t);
        mockups.push({
          templateId: t.id,
          templateName: t.name,
          blob,
          url: URL.createObjectURL(blob),
        });
        setProgress(40 + Math.round(((i + 1) / MOCKUP_TEMPLATES.length) * 55));
      }

      setAssets({
        pngBlob,
        jpgBlob,
        pdfBlob,
        originalName: file.name.replace(/\.[^.]+$/, "") || "artwork",
        mockups,
      });
      setProgress(100);
      setStep("done");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Generation failed");
      setStep("error");
    }
  }, []);

  const downloadFormat = useCallback(
    (f: "png" | "jpg" | "pdf") => {
      if (!assets) return;
      const map = { png: assets.pngBlob, jpg: assets.jpgBlob, pdf: assets.pdfBlob };
      saveAs(map[f], `${assets.originalName}.${f}`);
    },
    [assets],
  );

  const downloadMockup = useCallback(
    (id: string) => {
      if (!assets) return;
      const m = assets.mockups.find((x) => x.templateId === id);
      if (m) saveAs(m.blob, `${assets.originalName}-${id}.jpg`);
    },
    [assets],
  );

  const downloadAll = useCallback(async () => {
    if (!assets) return;
    const zip = new JSZip();
    zip.file(`${assets.originalName}.png`, assets.pngBlob);
    zip.file(`${assets.originalName}.jpg`, assets.jpgBlob);
    zip.file(`${assets.originalName}.pdf`, assets.pdfBlob);
    const folder = zip.folder("mockups")!;
    assets.mockups.forEach((m) =>
      folder.file(`${assets.originalName}-${m.templateId}.jpg`, m.blob),
    );
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${assets.originalName}-listing-bundle.zip`);
  }, [assets]);

  return {
    generate,
    step,
    progress,
    error,
    assets,
    downloadFormat,
    downloadMockup,
    downloadAll,
    reset,
    isLoading: step === "converting" || step === "generating-mockups",
  };
}
