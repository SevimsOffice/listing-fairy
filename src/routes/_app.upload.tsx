import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadListingImage } from "@/lib/upload.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowRight,
} from "lucide-react";

function UploadErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-md mx-auto mt-20 p-6 text-center">
      <h2 className="text-xl font-semibold">Upload page failed to load</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error?.message ?? "Unknown error"}</p>
      <Button onClick={reset} className="mt-4">Try again</Button>
    </div>
  );
}

export const Route = createFileRoute("/_app/upload")({
  component: UploadPage,
  errorComponent: UploadErrorComponent,
  head: () => ({ meta: [{ title: "Upload — Etsy Listing Generator" }] }),
});

type Status = "pending" | "uploading" | "success" | "error";

type Item = {
  id: string;
  file: File;
  preview: string;
  subject: string;
  gradeLevel: string;
  price: string;
  prompt: string;
  status: Status;
  error?: string;
};

const ACCEPTED = ["image/png", "image/jpeg"];
const MAX_BYTES = 10 * 1024 * 1024;

async function reencodeToJpeg(file: File): Promise<string> {
  // Re-encode via canvas to strip EXIF / sanitize. Returns base64 (no data: prefix).
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob((b) => res(b), "image/jpeg", 0.9),
  );
  if (!blob) throw new Error("Encode failed");

  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uploadFn = useServerFn(uploadListingImage);
  const inputRef = useRef<HTMLInputElement>(null);

  const [defaultPrice, setDefaultPrice] = useState("5.99");
  const [items, setItems] = useState<Item[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("settings")
      .select("default_price")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.default_price != null) {
          setDefaultPrice(String(data.default_price));
        }
      });
  }, [user]);

  useEffect(() => {
    return () => {
      items.forEach((i) => URL.revokeObjectURL(i.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const accepted: Item[] = [];
    let rejected = 0;
    for (const f of arr) {
      if (!ACCEPTED.includes(f.type)) {
        rejected++;
        continue;
      }
      if (f.size > MAX_BYTES) {
        rejected++;
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
        subject: "",
        gradeLevel: "",
        price: defaultPrice,
        prompt: "",
        status: "pending",
      });
    }
    if (rejected > 0) {
      toast.error(
        `${rejected} file${rejected > 1 ? "s" : ""} skipped (PNG/JPG, max 10MB)`,
      );
    }
    if (accepted.length > 0) setItems((prev) => [...prev, ...accepted]);
  }

  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  function clearAll() {
    items.forEach((i) => URL.revokeObjectURL(i.preview));
    setItems([]);
  }

  function validate(it: Item): string | null {
    if (it.subject.trim().length < 3) return "Subject must be at least 3 characters";
    if (it.gradeLevel.trim().length < 2) return "Grade level required";
    const price = Number(it.price);
    if (!Number.isFinite(price) || price < 0.2) return "Price must be at least $0.20";
    return null;
  }

  async function uploadAll() {
    const pending = items.filter((i) => i.status !== "success");
    for (const it of pending) {
      const err = validate(it);
      if (err) {
        toast.error(`Fix "${it.file.name}": ${err}`);
        return;
      }
    }

    setIsUploading(true);
    setProgress({ current: 0, total: pending.length });

    let successes = 0;
    for (let i = 0; i < pending.length; i++) {
      const it = pending[i];
      setProgress({ current: i + 1, total: pending.length });
      updateItem(it.id, { status: "uploading", error: undefined });

      try {
        const base64 = await reencodeToJpeg(it.file);
        const result = await uploadFn({
          data: {
            file: base64,
            filename: it.file.name.replace(/\.[^.]+$/, ".jpg"),
            subject: it.subject.trim(),
            gradeLevel: it.gradeLevel.trim(),
            prompt: it.prompt.trim() || undefined,
            price: Number(it.price),
          },
        });

        if (result.success) {
          updateItem(it.id, { status: "success" });
          successes++;
        } else {
          updateItem(it.id, { status: "error", error: result.error });
        }
      } catch (e) {
        updateItem(it.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Upload failed",
        });
      }
    }

    setIsUploading(false);

    if (successes === pending.length && successes > 0) {
      toast.success(`Uploaded ${successes} image${successes > 1 ? "s" : ""}`);
      navigate({ to: "/generate" });
    } else if (successes > 0) {
      toast.warning(`${successes} of ${pending.length} uploaded`);
    } else {
      toast.error("Upload failed");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 pb-32">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3">
          Step 2 of 4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Upload your designs
        </h1>
        <p className="text-muted-foreground mt-2">
          Drop your PNG or JPG images and add details for each listing.
        </p>
      </header>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 bg-card"
        }`}
      >
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">Drag images here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">
          PNG or JPG • Up to 10MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {items.map((it) => (
            <Card key={it.id} className="p-4 space-y-3">
              <div className="relative">
                <img
                  src={it.preview}
                  alt={it.file.name}
                  className="w-full aspect-square object-cover rounded-md border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  disabled={isUploading}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-background/90 border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="absolute top-2 left-2">
                  <StatusBadge status={it.status} />
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <Label htmlFor={`subject-${it.id}`} className="text-xs">
                    Subject
                  </Label>
                  <Input
                    id={`subject-${it.id}`}
                    value={it.subject}
                    onChange={(e) => updateItem(it.id, { subject: e.target.value })}
                    placeholder="Parts of the Brain"
                    disabled={isUploading || it.status === "success"}
                  />
                </div>
                <div>
                  <Label htmlFor={`grade-${it.id}`} className="text-xs">
                    Grade Level
                  </Label>
                  <Input
                    id={`grade-${it.id}`}
                    value={it.gradeLevel}
                    onChange={(e) =>
                      updateItem(it.id, { gradeLevel: e.target.value })
                    }
                    placeholder="4th Grade"
                    disabled={isUploading || it.status === "success"}
                  />
                </div>
                <div>
                  <Label htmlFor={`price-${it.id}`} className="text-xs">
                    Price ($)
                  </Label>
                  <Input
                    id={`price-${it.id}`}
                    type="number"
                    step="0.01"
                    min="0.20"
                    value={it.price}
                    onChange={(e) => updateItem(it.id, { price: e.target.value })}
                    disabled={isUploading || it.status === "success"}
                  />
                </div>
                <div>
                  <Label htmlFor={`prompt-${it.id}`} className="text-xs">
                    AI Prompt (optional)
                  </Label>
                  <Textarea
                    id={`prompt-${it.id}`}
                    value={it.prompt}
                    onChange={(e) => updateItem(it.id, { prompt: e.target.value })}
                    placeholder="Paste your image generation prompt here if available..."
                    rows={2}
                    disabled={isUploading || it.status === "success"}
                  />
                </div>
                {it.status === "error" && it.error && (
                  <p className="text-xs text-destructive">{it.error}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 border-t border-border bg-background/95 backdrop-blur p-4 z-10">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">
                {items.length} image{items.length > 1 ? "s" : ""} selected
              </Badge>
              {isUploading && (
                <span className="text-sm text-muted-foreground">
                  Uploading {progress.current} of {progress.total}...
                </span>
              )}
            </div>
            {isUploading && (
              <div className="w-full md:w-64 order-3 md:order-2">
                <Progress
                  value={(progress.current / Math.max(progress.total, 1)) * 100}
                />
              </div>
            )}
            <div className="flex gap-2 order-2 md:order-3">
              <Button variant="outline" onClick={clearAll} disabled={isUploading}>
                Clear All
              </Button>
              <Button
                onClick={uploadAll}
                disabled={isUploading || items.length === 0}
                className="bg-gradient-to-r from-primary to-primary/80"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    Upload & Continue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "uploading")
    return (
      <div className="bg-background/90 border border-border rounded-md px-2 py-1 flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
        Uploading
      </div>
    );
  if (status === "success")
    return (
      <div className="bg-green-600 text-white rounded-md px-2 py-1 flex items-center gap-1 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        Uploaded
      </div>
    );
  if (status === "error")
    return (
      <div className="bg-destructive text-destructive-foreground rounded-md px-2 py-1 flex items-center gap-1 text-xs">
        <XCircle className="h-3 w-3" />
        Error
      </div>
    );
  return null;
}
