import { useCallback, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { MOCKUP_TEMPLATES, compositeMockup } from "@/lib/mockupCompositor";
import { loadImageFromFile } from "@/lib/imageProcessor";
import { enhanceAndExport } from "@/lib/imageEnhancer";
import { generateInfoSlide } from "@/lib/infoSlideGenerator";

export type GeneratorStep =
  | "idle"
  | "upscaling"
  | "embedding-dpi"
  | "generating-pdf"
  | "generating-mockups"
  | "generating-slide"
  | "done"
  | "error";

type Mockup = { templateId: string; templateName: string; url: string; blob: Blob };

type Assets = {
  pngBlob: Blob;
  jpgBlob: Blob;
  pdfBlob: Blob;
  pngName: string;
  jpgName: string;
  pdfName: string;
  enhancedWidth: number;
  enhancedHeight: number;
  infoSlideBlob: Blob;
  infoSlideUrl: string;
  originalName: string;
  mockups: Mockup[];
};

export function useListingGenerator() {
  const [step, setStep] = useState<GeneratorStep>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [currentMockup, setCurrentMockup] = useState(0);

  const reset = useCallback(() => {
    if (assets) {
      assets.mockups.forEach((m) => URL.revokeObjectURL(m.url));
      URL.revokeObjectURL(assets.infoSlideUrl);
    }
    setStep("idle");
    setProgress(0);
    setError(null);
    setAssets(null);
    setCurrentMockup(0);
  }, [assets]);

  const generate = useCallback(async (file: File) => {
    try {
      setError(null);
      setAssets((prev) => {
        if (prev) {
          prev.mockups.forEach((m) => URL.revokeObjectURL(m.url));
          URL.revokeObjectURL(prev.infoSlideUrl);
        }
        return null;
      });
      setCurrentMockup(0);

      setStep("upscaling");
      setProgress(5);
      // Run enhancement in chunks so UI can update labels
      const enhanced = await enhanceAndExport(file, {
        targetDPI: 300,
        scaleFactor: 3.125,
        jpegQuality: 0.97,
        smoothing: "high",
      });
      setStep("embedding-dpi");
      setProgress(25);
      // (DPI metadata is embedded inside enhanceAndExport)
      setStep("generating-pdf");
      setProgress(35);

      // Load original (un-upscaled) artwork for mockup compositing
      const art = await loadImageFromFile(file);

      setStep("generating-mockups");
      const mockups: Mockup[] = [];
      for (let i = 0; i < MOCKUP_TEMPLATES.length; i++) {
        setCurrentMockup(i + 1);
        const t = MOCKUP_TEMPLATES[i];
        const blob = await compositeMockup(art, t);
        mockups.push({
          templateId: t.id,
          templateName: t.name,
          blob,
          url: URL.createObjectURL(blob),
        });
        setProgress(35 + Math.round(((i + 1) / MOCKUP_TEMPLATES.length) * 50));
      }

      setStep("generating-slide");
      const infoSlideBlob = await generateInfoSlide();
      const infoSlideUrl = URL.createObjectURL(infoSlideBlob);
      setProgress(100);

      setAssets({
        pngBlob: enhanced.png.blob,
        jpgBlob: enhanced.jpg.blob,
        pdfBlob: enhanced.pdf.blob,
        pngName: enhanced.png.name,
        jpgName: enhanced.jpg.name,
        pdfName: enhanced.pdf.name,
        enhancedWidth: enhanced.width,
        enhancedHeight: enhanced.height,
        infoSlideBlob,
        infoSlideUrl,
        originalName: file.name.replace(/\.[^.]+$/, "") || "artwork",
        mockups,
      });
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
      const map = {
        png: { blob: assets.pngBlob, name: assets.pngName },
        jpg: { blob: assets.jpgBlob, name: assets.jpgName },
        pdf: { blob: assets.pdfBlob, name: assets.pdfName },
      };
      saveAs(map[f].blob, map[f].name);
    },
    [assets],
  );

  const downloadMockup = useCallback(
    (id: string) => {
      if (!assets) return;
      if (id === "info-slide") {
        saveAs(assets.infoSlideBlob, `${assets.originalName}-info.jpg`);
        return;
      }
      const m = assets.mockups.find((x) => x.templateId === id);
      if (m) saveAs(m.blob, `${assets.originalName}-${id}.jpg`);
    },
    [assets],
  );

  const downloadAll = useCallback(async () => {
    if (!assets) return;
    const zip = new JSZip();
    zip.file(assets.pngName, assets.pngBlob);
    zip.file(assets.jpgName, assets.jpgBlob);
    zip.file(assets.pdfName, assets.pdfBlob);
    const folder = zip.folder("mockups")!;
    assets.mockups.forEach((m) =>
      folder.file(`${assets.originalName}-${m.templateId}.jpg`, m.blob),
    );
    folder.file(`${assets.originalName}-info.jpg`, assets.infoSlideBlob);
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `${assets.originalName}-listing-bundle.zip`);
  }, [assets]);

  const totalMockups = MOCKUP_TEMPLATES.length;
  const stepLabel: string =
    step === "upscaling"
      ? "Upscaling image to 4800 × 3200 px…"
      : step === "embedding-dpi"
        ? "Embedding 300 DPI metadata…"
        : step === "generating-pdf"
          ? "Generating print-ready PDF…"
          : step === "generating-mockups"
            ? `Generating mockup ${currentMockup}/${totalMockups}…`
            : step === "generating-slide"
              ? "Creating info slide…"
              : step === "done"
                ? "All assets ready! ✨"
                : "";

  return {
    generate,
    step,
    progress,
    error,
    assets,
    stepLabel,
    downloadFormat,
    downloadMockup,
    downloadAll,
    reset,
    isLoading:
      step === "upscaling" ||
      step === "embedding-dpi" ||
      step === "generating-pdf" ||
      step === "generating-mockups" ||
      step === "generating-slide",
  };
}
