// One-time authorisation. Sage redirects here with ?code=...; we swap it for tokens and store them.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SAGE_API, SAGE_TOKEN_URL } from '../_shared/sage.ts';
// deno-lint-ignore no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const code = new URL(req.url).searchParams.get('code');
  if (!code) return new Response('Missing ?code. Start from the authorisation link in the README.', { status: 400 });

  const res = await fetch(SAGE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: Deno.env.get('SAGE_REDIRECT_URI')!,
      client_id: Deno.env.get('SAGE_CLIENT_ID')!, client_secret: Deno.env.get('SAGE_CLIENT_SECRET')!,
    }),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) return new Response('Sage refused the code: ' + JSON.stringify(j), { status: 400 });

  let businessId: string | null = null;
  try {
    const b = await fetch(`${SAGE_API}/businesses`, { headers: { Authorization: `Bearer ${j.access_token}` } });
    businessId = (await b.json())?.$items?.[0]?.id ?? null;
  } catch { /* stored without a business id: Sage uses the default business */ }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await sb.from('sage_tokens').upsert({
    id: 1, access_token: j.access_token, refresh_token: j.refresh_token,
    expires_at: new Date(Date.now() + Number(j.expires_in ?? 300) * 1000).toISOString(),
    business_id: businessId, locked_until: null, updated_at: new Date().toISOString(),
  });
  return new Response('Sage is connected. You can close this tab.', { headers: { 'Content-Type': 'text/plain' } });
});
