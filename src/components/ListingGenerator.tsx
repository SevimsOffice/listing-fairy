import React, { useCallback, useState } from "react";
import { useListingGenerator } from "@/hooks/useListingGenerator";
import { MOCKUP_TEMPLATES } from "@/lib/mockupTemplates";

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
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
        ${
          dragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border bg-muted/30 hover:border-primary/60 hover:bg-primary/5"
        }`}
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
      <p className="font-semibold text-foreground text-base">
        Drop your artwork here
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        PNG, JPG or WEBP · High-res recommended (300 DPI)
      </p>
    </label>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-primary font-semibold">{value}%</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-[image:var(--gradient-primary)] rounded-full transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function FormatDownloads({
  onDownload,
}: {
  onDownload: (f: "png" | "jpg" | "pdf") => void;
}) {
  const formats = [
    { key: "png" as const, icon: "🖼️", label: "PNG", desc: "Transparent, lossless" },
    { key: "jpg" as const, icon: "📷", label: "JPG", desc: "Compressed, universal" },
    { key: "pdf" as const, icon: "📄", label: "PDF", desc: "Print-ready, A4" },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {formats.map(({ key, icon, label, desc }) => (
        <button
          key={key}
          onClick={() => onDownload(key)}
          className="flex flex-col items-center p-3 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <span className="text-2xl mb-1">{icon}</span>
          <span className="font-bold text-foreground text-sm group-hover:text-primary">
            {label}
          </span>
          <span className="text-xs text-muted-foreground mt-0.5 text-center">{desc}</span>
        </button>
      ))}
    </div>
  );
}

function MockupGrid({
  mockups,
  onDownload,
}: {
  mockups: { templateId: string; templateName: string; url: string }[];
  onDownload: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {mockups.map((m, i) => (
        <div
          key={m.templateId}
          className="group relative rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
        >
          {i === 0 && (
            <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              Hero Image #1
            </div>
          )}
          <img
            src={m.url}
            alt={m.templateName}
            className="w-full aspect-square object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button
              onClick={() => onDownload(m.templateId)}
              className="bg-background text-foreground font-semibold text-sm px-4 py-2 rounded-lg shadow hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              ⬇ Download
            </button>
          </div>
          <div className="px-3 py-2 text-sm font-medium text-muted-foreground bg-card border-t border-border">
            {m.templateName}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ListingGenerator() {
  const {
    generate,
    step,
    progress,
    error,
    assets,
    downloadFormat,
    downloadMockup,
    downloadAll,
    reset,
    isLoading,
  } = useListingGenerator();

  const stepLabel =
    step === "converting"
      ? "Converting to PNG, JPG & PDF…"
      : step === "generating-mockups"
        ? `Generating ${MOCKUP_TEMPLATES.length} room mockups…`
        : step === "done"
          ? "All assets ready!"
          : "";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Listing Fairy ✨</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload your artwork → get all Etsy listing images + download formats
        </p>
      </div>

      {(step === "idle" || step === "error") && (
        <div className="space-y-3">
          <UploadZone onFile={generate} />
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-sm text-destructive">
              ⚠️ {error}
              <button onClick={reset} className="ml-3 underline font-medium">
                Try again
              </button>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="space-y-4 bg-muted/30 rounded-2xl p-6 border border-border">
          <ProgressBar value={progress} label={stepLabel} />
          <p className="text-xs text-center text-muted-foreground">
            This happens entirely in your browser — no files leave your device
          </p>
        </div>
      )}

      {step === "done" && assets && (
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">📦 Digital Download Files</h2>
              <span className="text-xs text-muted-foreground">
                Include all 3 in your Etsy listing
              </span>
            </div>
            <FormatDownloads onDownload={downloadFormat} />
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">
                🖼️ Listing Images ({assets.mockups.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Etsy recommends 10 images
              </span>
            </div>
            <MockupGrid mockups={assets.mockups} onDownload={downloadMockup} />
          </section>

          <div className="flex gap-3">
            <button
              onClick={downloadAll}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl transition-colors"
            >
              ⬇ Download All Files
            </button>
            <button
              onClick={reset}
              className="px-5 py-3 rounded-xl border border-border text-muted-foreground hover:border-foreground/40 font-medium transition-colors"
            >
              New Image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
