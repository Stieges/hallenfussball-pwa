/**
 * CORS allowlist for edge functions.
 * Override via function secret: ALLOWED_ORIGINS="https://a.example,https://b.example"
 * Preview deployments must be added to ALLOWED_ORIGINS explicitly if needed.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://hallenfussball-pwa.vercel.app',
  'http://localhost:5173',
];

export function corsHeadersFor(req: Request): Record<string, string> {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  const allowedOrigins = configured
    ? configured.split(',').map((o) => o.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  const origin = req.headers.get('Origin') ?? '';
  const fallbackOrigin = allowedOrigins[0] ?? DEFAULT_ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin)
      ? origin
      : fallbackOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}
