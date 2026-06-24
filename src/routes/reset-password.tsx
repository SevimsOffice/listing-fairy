import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Store, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Set new password — Etsy Listing Generator" }] }),
});

const passwordSchema = z.object({
  password: z.string().min(8, "At least 8 characters").max(72),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (type !== "recovery" || !accessToken) {
      setValidating(false);
      setErrorMsg("Invalid or expired reset link. Please request a new one.");
      return;
    }

    supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? "",
      })
      .then(({ error }) => {
        if (error) {
          setErrorMsg(error.message);
        } else {
          setValid(true);
        }
        setValidating(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const parsed = passwordSchema.safeParse({ password });
    if (!parsed.success) {
      const msg = parsed.error.issues[0].message;
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
      } else {
        toast.success("Password updated! Please sign in with your new password.");
        await supabase.auth.signOut();
        navigate({ to: "/auth" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[image:var(--gradient-mesh)]">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)] mb-4">
            <Store className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Etsy Listing Generator</h1>
          <p className="text-sm text-muted-foreground mt-1">Bulk-create listings with AI</p>
        </div>

        <Card className="p-6 shadow-[var(--shadow-elegant)]">
          {validating ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Validating your reset link…</p>
            </div>
          ) : !valid ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-lg font-semibold">Link invalid or expired</h2>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Button asChild className="w-full bg-[image:var(--gradient-primary)] hover:opacity-90">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Set new password</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a strong new password for your account.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[image:var(--gradient-primary)] hover:opacity-90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update password
              </Button>
              {errorMsg && (
                <p className="text-sm text-destructive text-center">{errorMsg}</p>
              )}
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/auth" className="hover:text-foreground">← Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
