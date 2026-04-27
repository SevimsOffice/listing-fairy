import { createFileRoute } from "@tanstack/react-router";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_app/publish")({
  component: PublishPage,
  head: () => ({ meta: [{ title: "Publish — Etsy Listing Generator" }] }),
});

function PublishPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3">
          Step 4 of 4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Review & publish</h1>
        <p className="text-muted-foreground mt-2">Coming up next.</p>
      </header>
      <div className="rounded-2xl bg-card p-12 text-center border border-border">
        <Send className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Publish UI ships in the next iteration.</p>
      </div>
    </div>
  );
}
