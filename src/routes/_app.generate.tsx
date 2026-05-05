import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { generateListing } from "@/server/claude.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_app/generate")({
  component: GeneratePage,
  head: () => ({ meta: [{ title: "Generate — Etsy Listing Generator" }] }),
});

type ListingRow = {
  id: string;
  subject: string | null;
  grade_level: string | null;
  prompt: string | null;
  price: number | null;
  image_data: string | null;
  status: string;
  generated_title: string | null;
  generated_description: string | null;
  generated_tags: string[] | null;
  error_message: string | null;
};

type ItemState = "idle" | "generating" | "success" | "error";

function GeneratePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const generateFn = useServerFn(generateListing);

  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [defaultTags, setDefaultTags] = useState(
    "educational poster, science classroom, digital download",
  );
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!user) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    const [{ data: rows }, { data: settingsData }] = await Promise.all([
      supabase
        .from("draft_listings")
        .select(
          "id, subject, grade_level, prompt, price, image_data, status, generated_title, generated_description, generated_tags, error_message",
        )
        .eq("user_id", user.id)
        .in("status", ["pending_generation", "generated", "generation_failed"])
        .order("created_at", { ascending: true }),
      supabase
        .from("settings")
        .select("default_tags")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const list = (rows ?? []) as ListingRow[];
    setListings(list);

    if (settingsData?.default_tags) setDefaultTags(settingsData.default_tags);

    const initial: Record<string, ItemState> = {};
    const errors: Record<string, string> = {};
    for (const r of list) {
      if (r.status === "generated") initial[r.id] = "success";
      else if (r.status === "generation_failed") {
        initial[r.id] = "error";
        if (r.error_message) errors[r.id] = r.error_message;
      } else initial[r.id] = "idle";
    }
    setItemStates(initial);
    setItemErrors(errors);
    setLoading(false);
  }

  async function generateOne(listing: ListingRow) {
    setItemStates((s) => ({ ...s, [listing.id]: "generating" }));
    setItemErrors((e) => {
      const { [listing.id]: _, ...rest } = e;
      return rest;
    });

    try {
      const result = await generateFn({
        data: {
          subject: listing.subject ?? "",
          gradeLevel: listing.grade_level ?? "",
          originalPrompt: listing.prompt ?? undefined,
          defaultTags,
          imageId: listing.id,
        },
      });

      if (result.success) {
        await supabase
          .from("draft_listings")
          .update({
            generated_title: result.title,
            generated_description: result.description,
            generated_tags: result.tags,
            status: "generated",
            error_message: null,
          })
          .eq("id", listing.id);

        setItemStates((s) => ({ ...s, [listing.id]: "success" }));
        setListings((prev) =>
          prev.map((p) =>
            p.id === listing.id
              ? {
                  ...p,
                  status: "generated",
                  generated_title: result.title,
                  generated_description: result.description,
                  generated_tags: result.tags,
                  error_message: null,
                }
              : p,
          ),
        );
        return true;
      } else {
        const msg = result.error || "Generation failed";
        await supabase
          .from("draft_listings")
          .update({ status: "generation_failed", error_message: msg })
          .eq("id", listing.id);

        setItemStates((s) => ({ ...s, [listing.id]: "error" }));
        setItemErrors((e) => ({ ...e, [listing.id]: msg }));
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      await supabase
        .from("draft_listings")
        .update({ status: "generation_failed", error_message: msg })
        .eq("id", listing.id);

      setItemStates((s) => ({ ...s, [listing.id]: "error" }));
      setItemErrors((e) => ({ ...e, [listing.id]: msg }));
      return false;
    }
  }

  async function runBatch(items: ListingRow[]) {
    if (items.length === 0) return;
    setIsGenerating(true);
    setProgress({ current: 0, total: items.length });

    let successes = 0;
    let failures = 0;

    for (let i = 0; i < items.length; i++) {
      setProgress({ current: i + 1, total: items.length });
      const ok = await generateOne(items[i]);
      if (ok) successes++;
      else failures++;
    }

    setIsGenerating(false);
    if (failures === 0) toast.success(`Generated ${successes} listings`);
    else
      toast.warning(`${successes} succeeded, ${failures} failed`, {
        description: "Use 'Regenerate Failed' to retry.",
      });
  }

  async function removeListing(listing: ListingRow) {
    if (!user) return;
    if (!confirm("Remove this listing? This cannot be undone.")) return;
    const prev = listings;
    setListings((p) => p.filter((l) => l.id !== listing.id));
    const { error } = await supabase
      .from("draft_listings")
      .delete()
      .eq("id", listing.id)
      .eq("user_id", user.id);
    if (error) {
      setListings(prev);
      toast.error("Failed to remove", { description: error.message });
    } else {
      toast.success("Listing removed");
    }
  }

  const pending = listings.filter(
    (l) => itemStates[l.id] === "idle" || itemStates[l.id] === "error",
  );
  const failed = listings.filter((l) => itemStates[l.id] === "error");
  const allDone =
    listings.length > 0 &&
    listings.every((l) => itemStates[l.id] === "success");

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3">
          Step 3 of 4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Generate AI listings
        </h1>
        <p className="text-muted-foreground mt-2">
          Generate SEO-optimized titles, descriptions, and tags for each design.
        </p>
      </header>

      {listings.length === 0 ? (
        <Card className="p-12 text-center">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">
            No images ready for generation. Upload some designs first.
          </p>
          <Button asChild>
            <Link to="/upload">Go to Upload</Link>
          </Button>
        </Card>
      ) : (
        <>
          <Card className="p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium">
                  {isGenerating
                    ? `Generating ${progress.current} of ${progress.total}...`
                    : `${listings.filter((l) => itemStates[l.id] === "success").length} of ${listings.length} generated`}
                </span>
                {failed.length > 0 && !isGenerating && (
                  <span className="text-destructive text-xs">
                    {failed.length} failed
                  </span>
                )}
              </div>
              <Progress
                value={
                  isGenerating
                    ? (progress.current / Math.max(progress.total, 1)) * 100
                    : (listings.filter((l) => itemStates[l.id] === "success")
                        .length /
                        listings.length) *
                      100
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {failed.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => runBatch(failed)}
                  disabled={isGenerating}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Failed
                </Button>
              )}
              <Button
                onClick={() => runBatch(pending)}
                disabled={isGenerating || pending.length === 0}
                className="bg-gradient-to-r from-primary to-primary/80"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate All Listings
                  </>
                )}
              </Button>
              <Button
                onClick={() => navigate({ to: "/publish" })}
                disabled={!allDone || isGenerating}
                variant={allDone ? "default" : "outline"}
              >
                Next: Review & Publish
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </Card>

          <div className="space-y-3">
            {listings.map((listing) => {
              const state = itemStates[listing.id] ?? "idle";
              const error = itemErrors[listing.id];
              return (
                <Card key={listing.id} className="p-4">
                  <div className="flex gap-4">
                    {listing.image_data ? (
                      <img
                        src={listing.image_data}
                        alt={listing.subject ?? "design"}
                        className="h-20 w-20 rounded-md object-cover border border-border flex-shrink-0"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-md bg-muted flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {listing.generated_title ||
                              listing.subject ||
                              "Untitled"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {listing.subject ?? "—"} •{" "}
                            {listing.grade_level ?? "—"} •{" "}
                            {listing.price != null
                              ? `$${listing.price.toFixed(2)}`
                              : "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusIcon state={state} />
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={isGenerating || state === "generating"}
                            onClick={() => removeListing(listing)}
                            aria-label="Remove listing"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {state === "success" && listing.generated_tags && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
                          {listing.generated_tags.slice(0, 6).join(" • ")}
                        </p>
                      )}
                      {state === "error" && error && (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-xs text-destructive truncate">
                            {error}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isGenerating}
                            onClick={() => runBatch([listing])}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatusIcon({ state }: { state: ItemState }) {
  if (state === "generating")
    return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
  if (state === "success")
    return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (state === "error") return <XCircle className="h-5 w-5 text-destructive" />;
  return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
}
