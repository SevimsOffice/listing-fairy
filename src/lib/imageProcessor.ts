import jsPDF from "jspdf";

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
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

function canvasToBlob(canvas: HTMLCanvasElement, type: string, q = 0.92): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, q),
  );
}

export async function imageToPng(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  return canvasToBlob(canvas, "image/png");
}

export async function imageToJpg(img: HTMLImageElement, q = 0.95): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvasToBlob(canvas, "image/jpeg", q);
}

export async function imageToPdf(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const isPortrait = canvas.height >= canvas.width;
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: isPortrait ? "portrait" : "landscape",
  });
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
    canvas.toDataURL("image/jpeg", 0.95),
    "JPEG",
    (pageW - w) / 2,
    (pageH - h) / 2,
    w,
    h,
  );
  return pdf.output("blob");
}
