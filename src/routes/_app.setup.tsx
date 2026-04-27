import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { startEtsyOAuth, disconnectEtsy } from "@/server/etsy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Store,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Link2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_app/setup")({
  component: SetupPage,
  head: () => ({ meta: [{ title: "Setup — Etsy Listing Generator" }] }),
});

const settingsSchema = z.object({
  default_price: z.coerce.number().min(0.2, "Min $0.20").max(50000),
  default_tags: z.string().trim().min(1).max(500),
  shipping_profile: z.string().min(1),
  category: z.string().min(1),
});

const categories = [
  "Art & Collectibles > Prints > Digital Prints",
  "Art & Collectibles > Prints > Giclée",
  "Craft Supplies & Tools > Patterns & How To",
  "Paper & Party Supplies > Paper > Stationery",
];

function SetupPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [defaultPrice, setDefaultPrice] = useState("5.99");
  const [defaultTags, setDefaultTags] = useState(
    "educational poster, science classroom, digital download",
  );
  const [shippingProfile, setShippingProfile] = useState("free");
  const [category, setCategory] = useState(categories[0]);

  const [etsyConnection, setEtsyConnection] = useState<{
    shop_name: string | null;
    updated_at: string;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchEtsyConnection = async (userId: string) => {
    const { data } = await supabase
      .from("etsy_connections")
      .select("shop_name, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    setEtsyConnection(data ?? null);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: s }] = await Promise.all([
        supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle(),
        fetchEtsyConnection(user.id),
      ]);
      if (s) {
        setDefaultPrice(String(s.default_price));
        setDefaultTags(s.default_tags);
        setShippingProfile(s.shipping_profile);
        setCategory(s.category);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    const parsed = settingsSchema.safeParse({
      default_price: defaultPrice,
      default_tags: defaultTags,
      shipping_profile: shippingProfile,
      category,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("settings").upsert(
      { user_id: user.id, ...parsed.data },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Settings saved");
  };

  const startOAuth = useServerFn(startEtsyOAuth);
  const disconnect = useServerFn(disconnectEtsy);

  // Show toast if redirected back from callback (handled by callback page itself,
  // but refresh shop name here)
  useEffect(() => {
    if (!user) return;
    const onFocus = async () => {
      const { data } = await supabase
        .from("etsy_connections")
        .select("shop_name")
        .eq("user_id", user.id)
        .maybeSingle();
      setEtsyShopName(data?.shop_name ?? null);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  const connectEtsy = async () => {
    setConnecting(true);
    try {
      const res = await startOAuth({ data: { origin: window.location.origin } });
      if (res.error) {
        toast.error(res.error);
        setConnecting(false);
        return;
      }
      window.location.href = res.url!;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start Etsy OAuth");
      setConnecting(false);
    }
  };

  const disconnectEtsyHandler = async () => {
    if (!confirm("Disconnect your Etsy shop?")) return;
    const res = await disconnect({});
    if (res.error) toast.error(res.error);
    else {
      setEtsyShopName(null);
      toast.success("Etsy disconnected");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 text-xs font-medium text-primary mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          Step 1 of 4
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Setup your generator
        </h1>
        <p className="text-muted-foreground mt-2">
          Connect Etsy and configure defaults. You'll only do this once.
        </p>
      </header>

      {/* Etsy connection */}
      <Card className="p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] shrink-0">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold">Etsy connection</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Authorize your Etsy shop to publish listings.
              </p>
              {etsyShopName ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected to {etsyShopName}
                </div>
              ) : (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" />
                  Not connected
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button onClick={connectEtsy} disabled={connecting} variant="outline">
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {etsyShopName ? "Reconnect" : "Connect to Etsy"}
            </Button>
            {etsyShopName && (
              <Button
                onClick={disconnectEtsyHandler}
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Defaults */}
      <Card className="p-6 shadow-sm space-y-5">
        <div>
          <h2 className="font-semibold">Default listing settings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Pre-fills every new listing. You can override per item.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="price">Default price (USD)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0.20"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ship">Shipping profile</Label>
            <Select value={shippingProfile} onValueChange={setShippingProfile}>
              <SelectTrigger id="ship">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free shipping</SelectItem>
                <SelectItem value="digital">Digital download (no shipping)</SelectItem>
                <SelectItem value="standard">Standard rates</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Standard tags (comma-separated)</Label>
          <Textarea
            id="tags"
            value={defaultTags}
            onChange={(e) => setDefaultTags(e.target.value)}
            rows={3}
            placeholder="educational poster, science classroom, digital download"
          />
          <p className="text-xs text-muted-foreground">
            Used as the seed tags. AI will expand to 13 per listing.
          </p>
        </div>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          className="text-muted-foreground"
        >
          <Link to="/upload">
            Skip to upload
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
        <Button
          onClick={save}
          disabled={saving}
          size="lg"
          className="bg-[image:var(--gradient-primary)] hover:opacity-90 shadow-[var(--shadow-elegant)]"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save settings
        </Button>
      </div>
    </div>
  );
}
