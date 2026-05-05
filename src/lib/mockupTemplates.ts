// Mockup templates: each defines a room scene and where to place artwork.
// Scenes are generated as SVG backgrounds so no external assets are required.

export type MockupTemplate = {
  id: string;
  name: string;
  // Background as a CSS gradient/SVG data URL
  background: string;
  // Frame placement (percentages of canvas)
  frame: { x: number; y: number; width: number; height: number };
  // Frame styling
  frameColor: string;
  matColor: string;
};

export const MOCKUP_TEMPLATES: MockupTemplate[] = [
  {
    id: "living-room",
    name: "Cozy Living Room",
    background:
      "linear-gradient(180deg, #e8dfd3 0%, #e8dfd3 60%, #c9b89a 60%, #b8a583 100%)",
    frame: { x: 0.3, y: 0.15, width: 0.4, height: 0.5 },
    frameColor: "#2a1f17",
    matColor: "#f8f4ec",
  },
  {
    id: "bedroom",
    name: "Modern Bedroom",
    background:
      "linear-gradient(180deg, #f0e8df 0%, #e6dccf 55%, #8b7355 55%, #6b5640 100%)",
    frame: { x: 0.32, y: 0.1, width: 0.36, height: 0.45 },
    frameColor: "#1a1410",
    matColor: "#ffffff",
  },
  {
    id: "office",
    name: "Minimal Office",
    background:
      "linear-gradient(180deg, #ffffff 0%, #f5f5f5 65%, #d4d4d4 65%, #b8b8b8 100%)",
    frame: { x: 0.28, y: 0.18, width: 0.44, height: 0.48 },
    frameColor: "#3a3a3a",
    matColor: "#f8f8f8",
  },
  {
    id: "nursery",
    name: "Sweet Nursery",
    background:
      "linear-gradient(180deg, #fce4ec 0%, #f8d7e0 60%, #d4a5b3 60%, #b88a98 100%)",
    frame: { x: 0.3, y: 0.12, width: 0.4, height: 0.5 },
    frameColor: "#fafafa",
    matColor: "#fff5f8",
  },
  {
    id: "gallery-wall",
    name: "Gallery Wall",
    background:
      "linear-gradient(180deg, #ede4d3 0%, #ede4d3 70%, #c2b395 70%, #a89878 100%)",
    frame: { x: 0.34, y: 0.18, width: 0.32, height: 0.42 },
    frameColor: "#d4af37",
    matColor: "#faf8f3",
  },
  {
    id: "scandi",
    name: "Scandinavian Style",
    background:
      "linear-gradient(180deg, #fafafa 0%, #f0eee8 65%, #c8b89a 65%, #a89878 100%)",
    frame: { x: 0.3, y: 0.14, width: 0.4, height: 0.5 },
    frameColor: "#e8dcc4",
    matColor: "#ffffff",
  },
];
