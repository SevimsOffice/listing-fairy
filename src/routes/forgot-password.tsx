import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Store, Loader2, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — Etsy Listing Generator" }] }),
});

const emailSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      const msg = parsed.error.issues[0].message;
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
      } else {
        setSent(true);
        toast.success("Check your email for the reset link.");
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
          {sent ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-success" />
              <h2 className="text-lg font-semibold">Email sent</h2>
              <p className="text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Reset your password</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we will send you a link to reset your password.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-[image:var(--gradient-primary)] hover:opacity-90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send reset link
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
