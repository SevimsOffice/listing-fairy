import room1 from "@/assets/mockups/room-1-living-white.jpg";
import room2 from "@/assets/mockups/room-2-boho.jpg";
import room3 from "@/assets/mockups/room-3-brick-desk.jpg";
import room4 from "@/assets/mockups/room-4-midcentury.jpg";
import room5 from "@/assets/mockups/room-5-scandinavian.jpg";

export type MockupTemplate = {
  id: string;
  name: string;
  image: string;
  // Frame placement as fractions of the room image (where to paste artwork)
  frame: { x: number; y: number; width: number; height: number };
};

export const MOCKUP_TEMPLATES: MockupTemplate[] = [
  {
    id: "living-white",
    name: "White Living Room",
    image: room1,
    frame: { x: 0.395, y: 0.10, width: 0.235, height: 0.62 },
  },
  {
    id: "boho",
    name: "Boho Rattan",
    image: room2,
    frame: { x: 0.27, y: 0.13, width: 0.235, height: 0.61 },
  },
  {
    id: "brick-desk",
    name: "Brick Wall Desk",
    image: room3,
    frame: { x: 0.21, y: 0.04, width: 0.62, height: 0.62 },
  },
  {
    id: "midcentury",
    name: "Mid-Century Sideboard",
    image: room4,
    frame: { x: 0.42, y: 0.20, width: 0.32, height: 0.34 },
  },
  {
    id: "scandinavian",
    name: "Scandinavian Tan",
    image: room5,
    frame: { x: 0.32, y: 0.10, width: 0.275, height: 0.57 },
  },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", q = 0.92): Promise<Blob> {
  return new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, q),
  );
}

export async function compositeMockup(
  art: HTMLImageElement,
  template: MockupTemplate,
): Promise<Blob> {
  const room = await loadImage(template.image);
  const canvas = document.createElement("canvas");
  canvas.width = room.naturalWidth;
  canvas.height = room.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(room, 0, 0);

  const fx = template.frame.x * canvas.width;
  const fy = template.frame.y * canvas.height;
  const fw = template.frame.width * canvas.width;
  const fh = template.frame.height * canvas.height;

  // Fit artwork preserving aspect ratio inside the frame area
  const ratio = Math.min(fw / art.naturalWidth, fh / art.naturalHeight);
  const dw = art.naturalWidth * ratio;
  const dh = art.naturalHeight * ratio;
  const dx = fx + (fw - dw) / 2;
  const dy = fy + (fh - dh) / 2;

  // Cover any existing artwork on the wall with a solid white block
  // sized to the full frame area before placing the new artwork.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(fx, fy, fw, fh);

  // Subtle drop shadow for realism around the placed artwork
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#fff";
  ctx.fillRect(dx, dy, dw, dh);
  ctx.restore();

  ctx.drawImage(art, dx, dy, dw, dh);

  return canvasToBlob(canvas, "image/jpeg", 0.9);
}
