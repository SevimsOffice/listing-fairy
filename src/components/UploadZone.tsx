import { useCallback, useState } from "react";
import { getImageDimensions } from "@/lib/imageEnhancer";

export function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [info, setInfo] = useState<{ w: number; h: number } | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const { width, height } = await getImageDimensions(file);
        setInfo({ w: width, h: height });
      } catch {
        setInfo(null);
      }
      onFile(file);
    },
    [onFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="space-y-2">
      <label
        className={`relative flex flex-col items-center justify-center w-full h-56 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
          ${dragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border bg-muted/30 hover:border-primary/60 hover:bg-primary/5"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        <div className="text-4xl mb-3">🖼️</div>
        <p className="font-semibold text-foreground text-base">Drop your artwork here</p>
        <p className="text-sm text-muted-foreground mt-1">
          PNG, JPG or WEBP · We'll upscale to 300 DPI for printing
        </p>
      </label>

      {info && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          <span className="text-muted-foreground/70">Original</span>
          <span className="font-medium text-foreground">
            {info.w} × {info.h} px
          </span>
          <span className="text-muted-foreground/40">→</span>
          <span className="text-emerald-600 font-semibold">Enhanced</span>
          <span className="text-emerald-600 font-semibold">
            {Math.round(info.w * 3.125)} × {Math.round(info.h * 3.125)} px · 300 DPI
          </span>
        </div>
      )}
    </div>
  );
}
