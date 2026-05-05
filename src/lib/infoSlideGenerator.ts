function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", q = 0.92): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, q),
  );
}

export async function generateInfoSlide(): Promise<Blob> {
  const W = 2000;
  const H = 2000;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#fafaf7";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.font = "bold 96px Georgia, serif";
  ctx.fillText("INSTANT DIGITAL DOWNLOAD", W / 2, 240);

  ctx.font = "italic 56px Georgia, serif";
  ctx.fillStyle = "#555";
  ctx.fillText("Print at home or at your local print shop", W / 2, 330);

  // Steps
  const steps = [
    ["1", "PURCHASE", "Buy this listing"],
    ["2", "DOWNLOAD", "Files available instantly"],
    ["3", "PRINT", "At home or print shop"],
    ["4", "FRAME & ENJOY", "Hang your beautiful art"],
  ];
  const stepY = 600;
  const colW = W / steps.length;
  steps.forEach(([num, title, desc], i) => {
    const cx = colW * i + colW / 2;
    ctx.fillStyle = "#2d2d2d";
    ctx.beginPath();
    ctx.arc(cx, stepY, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 90px Georgia, serif";
    ctx.fillText(num, cx, stepY + 32);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 44px Georgia, serif";
    ctx.fillText(title, cx, stepY + 220);
    ctx.fillStyle = "#666";
    ctx.font = "32px Georgia, serif";
    ctx.fillText(desc, cx, stepY + 280);
  });

  // Features
  const features = [
    "✓ High-resolution 300 DPI files",
    "✓ Multiple sizes: 8x10, 11x14, 16x20, A4, A3",
    "✓ PNG, JPG & PDF formats included",
    "✓ No physical item — instant download",
  ];
  ctx.textAlign = "left";
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "44px Georgia, serif";
  features.forEach((f, i) => ctx.fillText(f, 280, 1180 + i * 90));

  // Note
  ctx.textAlign = "center";
  ctx.fillStyle = "#8b6f47";
  ctx.font = "italic 38px Georgia, serif";
  ctx.fillText(
    "This is a digital product. No physical poster will be mailed.",
    W / 2,
    1750,
  );

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 56px Georgia, serif";
  ctx.fillText("Lil Preneur ✨", W / 2, 1900);

  return canvasToBlob(canvas, "image/jpeg", 0.92);
}
