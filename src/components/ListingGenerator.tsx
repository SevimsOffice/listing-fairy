import { useListingGenerator } from "@/hooks/useListingGenerator";
import { UploadZone } from "@/components/UploadZone";
import { ProgressBar } from "@/components/ProgressBar";
import { FormatDownloads } from "@/components/FormatDownloads";
import { MockupGrid } from "@/components/MockupGrid";
import { MOCKUP_TEMPLATES } from "@/lib/mockupCompositor";

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
        : step === "generating-info"
          ? "Creating info slide…"
          : step === "done"
            ? "All assets ready!"
            : "";

  const allMockups = assets
    ? [
        ...assets.mockups,
        {
          templateId: "info-slide",
          templateName: "Info Slide",
          url: assets.infoSlideUrl,
        },
      ]
    : [];

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
                🖼️ Listing Images ({allMockups.length})
              </h2>
              <span className="text-xs text-muted-foreground">
                Etsy recommends 10 images
              </span>
            </div>
            <MockupGrid mockups={allMockups} onDownload={downloadMockup} />
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
