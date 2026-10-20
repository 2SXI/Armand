// Sage refresh tokens rotate and can be used ONCE. If two refreshes run at the same time Sage
// can invalidate both, so only one caller refreshes (row lock) and the others wait.
import { SAGE_TOKEN_URL } from './sage.ts';
// deno-lint-ignore no-explicit-any
type SB = any;
// deno-lint-ignore no-explicit-any
declare const Deno: any;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getAccessToken(sb: SB): Promise<{ token: string; businessId: string | null }> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data: row } = await sb.from('sage_tokens').select('*').eq('id', 1).single();
    if (!row?.refresh_token) throw new Error('Sage is not connected yet. Do the one-time authorisation (see README).');
    const fresh = row.access_token && row.expires_at && new Date(row.expires_at).getTime() - Date.now() > 60_000;
    if (fresh) return { token: row.access_token, businessId: row.business_id };

    const lockUntil = new Date(Date.now() + 30_000).toISOString();
    const { data: got } = await sb.from('sage_tokens')
      .update({ locked_until: lockUntil })
      .eq('id', 1)
      .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`)
      .select('*');
    if (!got || got.length === 0) { await sleep(1000); continue; }   // another call is refreshing

    try {
      const res = await fetch(SAGE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: row.refresh_token,
          client_id: Deno.env.get('SAGE_CLIENT_ID')!,
          client_secret: Deno.env.get('SAGE_CLIENT_SECRET')!,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.access_token) throw new Error(`Sage token refresh failed (${res.status}): ${JSON.stringify(j).slice(0, 300)}`);
      await sb.from('sage_tokens').update({
        access_token: j.access_token,
        refresh_token: j.refresh_token,                         // overwrite: the old one is now dead
        expires_at: new Date(Date.now() + Number(j.expires_in ?? 300) * 1000).toISOString(),
        locked_until: null,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      return { token: j.access_token, businessId: row.business_id };
    } catch (e) {
      await sb.from('sage_tokens').update({ locked_until: null }).eq('id', 1);
      throw e;
    }
  }
  throw new Error('Timed out waiting for a Sage token');
}
