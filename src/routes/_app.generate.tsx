import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_app/generate")({
  component: GeneratePage,
  head: () => ({ meta: [{ title: "Generate — Etsy Listing Generator" }] }),
});

function GeneratePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3">
          Step 3 of 4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Generate AI listings</h1>
        <p className="text-muted-foreground mt-2">Coming up next.</p>
      </header>
      <div className="rounded-2xl bg-card p-12 text-center border border-border">
        <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">AI generation ships in the next iteration.</p>
      </div>
    </div>
  );
}
