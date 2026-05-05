import { useCallback, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { MOCKUP_TEMPLATES, compositeMockup } from "@/lib/mockupCompositor";
import {
  imageToJpg,
  imageToPdf,
  imageToPng,
  loadImageFromFile,
} from "@/lib/imageProcessor";
import { generateInfoSlide } from "@/lib/infoSlideGenerator";

export type GeneratorStep =
  | "idle"
  | "converting"
  | "generating-mockups"
  | "generating-info"
  | "done"
  | "error";

type Mockup = { templateId: string; templateName: string; url: string; blob: Blob };

type Assets = {
  pngBlob: Blob;
  jpgBlob: Blob;
  pdfBlob: Blob;
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

  const reset = useCallback(() => {
    if (assets) {
      assets.mockups.forEach((m) => URL.revokeObjectURL(m.url));
      URL.revokeObjectURL(assets.infoSlideUrl);
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
      setProgress(5);

      const art = await loadImageFromFile(file);
      const pngBlob = await imageToPng(art);
      setProgress(20);
      const jpgBlob = await imageToJpg(art);
      setProgress(30);
      const pdfBlob = await imageToPdf(art);
      setProgress(40);

      setStep("generating-mockups");
      const mockups: Mockup[] = [];
      for (let i = 0; i < MOCKUP_TEMPLATES.length; i++) {
        const t = MOCKUP_TEMPLATES[i];
        const blob = await compositeMockup(art, t);
        mockups.push({
          templateId: t.id,
          templateName: t.name,
          blob,
          url: URL.createObjectURL(blob),
        });
        setProgress(40 + Math.round(((i + 1) / MOCKUP_TEMPLATES.length) * 45));
      }

      setStep("generating-info");
      const infoSlideBlob = await generateInfoSlide();
      const infoSlideUrl = URL.createObjectURL(infoSlideBlob);
      setProgress(100);

      setAssets({
        pngBlob,
        jpgBlob,
        pdfBlob,
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
      const map = { png: assets.pngBlob, jpg: assets.jpgBlob, pdf: assets.pdfBlob };
      saveAs(map[f], `${assets.originalName}.${f}`);
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
    zip.file(`${assets.originalName}.png`, assets.pngBlob);
    zip.file(`${assets.originalName}.jpg`, assets.jpgBlob);
    zip.file(`${assets.originalName}.pdf`, assets.pdfBlob);
    const folder = zip.folder("mockups")!;
    assets.mockups.forEach((m) =>
      folder.file(`${assets.originalName}-${m.templateId}.jpg`, m.blob),
    );
    folder.file(`${assets.originalName}-info.jpg`, assets.infoSlideBlob);
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
    isLoading:
      step === "converting" ||
      step === "generating-mockups" ||
      step === "generating-info",
  };
}
