-- Replace the broad FOR ALL policy on etsy_connections with command-specific policies
-- that exclude SELECT from the client (tokens must never be readable via the public API).
DROP POLICY IF EXISTS "Users manage own etsy" ON public.etsy_connections;

CREATE POLICY "Users insert own etsy"
  ON public.etsy_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own etsy"
  ON public.etsy_connections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own etsy"
  ON public.etsy_connections
  FOR DELETE
  USING (auth.uid() = user_id);

-- Note: No SELECT policy is created. Client cannot read this table at all.
-- Server-side code uses supabaseAdmin (service role) which bypasses RLS.

-- Expose only non-sensitive status fields to authenticated users via a security_invoker view.
CREATE OR REPLACE VIEW public.etsy_connection_status
WITH (security_invoker = true)
AS
SELECT user_id, shop_name, shop_id, updated_at
FROM public.etsy_connections
WHERE auth.uid() = user_id;

GRANT SELECT ON public.etsy_connection_status TO authenticated;