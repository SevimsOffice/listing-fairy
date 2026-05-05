import { useCallback, useState } from "react";

export function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) onFile(file);
    },
    [onFile],
  );

  return (
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
          if (file) onFile(file);
        }}
      />
      <div className="text-4xl mb-3">🖼️</div>
      <p className="font-semibold text-foreground text-base">Drop your artwork here</p>
      <p className="text-sm text-muted-foreground mt-1">
        PNG, JPG or WEBP · High-res recommended (300 DPI)
      </p>
    </label>
  );
}
