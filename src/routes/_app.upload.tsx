import { createFileRoute } from "@tanstack/react-router";
import { Upload as UploadIcon } from "lucide-react";

export const Route = createFileRoute("/_app/upload")({
  component: UploadPage,
  head: () => ({ meta: [{ title: "Upload — Etsy Listing Generator" }] }),
});

function UploadPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3">
          Step 2 of 4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Upload your product images
        </h1>
        <p className="text-muted-foreground mt-2">Coming up next.</p>
      </header>

      <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center bg-card/50">
        <UploadIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Upload UI ships in the next iteration.</p>
      </div>
    </div>
  );
}
