import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
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
  Clock,
  RefreshCw,
} from "lucide-react";

function SetupErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="max-w-md w-full p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Setup failed to load</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't load your setup page. Please try again.
        </p>
        {import.meta.env.DEV && error?.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            <RefreshCw className="mr-1" /> Retry
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Go home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/setup")({
  component: SetupPage,
  errorComponent: SetupErrorComponent,
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
  const [timedOut, setTimedOut] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
      .from("etsy_connection_status" as never)
      .select("shop_name, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    setEtsyConnection((data as { shop_name: string | null; updated_at: string } | null) ?? null);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setTimedOut(false);

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setTimedOut(true);
    }, 10000);

    (async () => {
      try {
        const [{ data: s }] = await Promise.all([
          supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle(),
          fetchEtsyConnection(user.id),
        ]);
        if (cancelled) return;
        if (s) {
          setDefaultPrice(String(s.default_price));
          setDefaultTags(s.default_tags);
          setShippingProfile(s.shipping_profile);
          setCategory(s.category);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Setup load failed:", e);
          setTimedOut(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          window.clearTimeout(timeoutId);
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [user, loadAttempt]);

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

  // Refresh shop status when user returns from Etsy consent screen
  useEffect(() => {
    if (!user) return;
    const onFocus = () => fetchEtsyConnection(user.id);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "etsy-oauth-complete") return;
      fetchEtsyConnection(user.id);
      if (event.data.ok) toast.success("Etsy connected");
      else toast.error("Etsy refused to connect. Please try again.");
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("message", onMessage);
    };
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
      const popup = window.open(res.url!, "etsy-oauth", "width=720,height=760");
      if (!popup) {
        toast.error("Popup blocked. Please allow popups and try again.");
        setConnecting(false);
        return;
      }
      const popupCheck = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(popupCheck);
          setConnecting(false);
          if (user) fetchEtsyConnection(user.id);
        }
      }, 500);
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
      setEtsyConnection(null);
      toast.success("Etsy disconnected");
    }
  };

  const isConnected = !!etsyConnection;
  const shopName = etsyConnection?.shop_name ?? null;
  const lastSync = etsyConnection?.updated_at
    ? new Date(etsyConnection.updated_at)
    : null;
  const lastSyncLabel = lastSync
    ? lastSync.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  if (loading) {
    if (timedOut) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <Card className="max-w-md w-full p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Clock className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Setup is taking too long
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn't load your setup in time. Please check your connection and try again.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button onClick={() => setLoadAttempt((n) => n + 1)}>
                <RefreshCw className="h-4 w-4 mr-1" /> Retry
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Go home</Link>
              </Button>
            </div>
          </Card>
        </div>
      );
    }
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

      {/* Etsy connection status */}
      <Card
        className={`p-6 shadow-sm border-2 transition-colors ${
          isConnected
            ? "border-success/30 bg-success/[0.03]"
            : "border-border"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                isConnected
                  ? "bg-success/15"
                  : "bg-[image:var(--gradient-primary)]"
              }`}
            >
              <Store
                className={`h-6 w-6 ${
                  isConnected ? "text-success" : "text-primary-foreground"
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold">Etsy connection</h2>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                    Not connected
                  </span>
                )}
              </div>

              {isConnected ? (
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Shop
                    </dt>
                    <dd className="font-medium truncate">
                      {shopName ?? "Etsy account"}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Last sync
                    </dt>
                    <dd className="font-medium">{lastSyncLabel}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Authorize your Etsy shop so we can publish listings on your
                  behalf. Takes about 30 seconds.
                </p>
              )}
            </div>
          </div>

          <div className="flex md:flex-col gap-2 shrink-0">
            <Button
              onClick={connectEtsy}
              disabled={connecting}
              variant={isConnected ? "outline" : "default"}
              className={
                !isConnected
                  ? "bg-[image:var(--gradient-primary)] hover:opacity-90 shadow-[var(--shadow-elegant)]"
                  : ""
              }
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : isConnected ? (
                <RefreshCw className="h-4 w-4 mr-2" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {isConnected ? "Reconnect" : "Connect to Etsy"}
            </Button>
            {isConnected && (
              <Button
                onClick={disconnectEtsyHandler}
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
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
