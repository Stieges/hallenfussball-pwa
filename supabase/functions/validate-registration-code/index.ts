/**
 * Edge Function: validate-registration-code
 *
 * Server-side validation of registration codes to prevent exposure in client bundle.
 *
 * Security:
 * - Registration code stored in Supabase Secrets (not in client bundle)
 * - Case-insensitive comparison
 * - Rate limiting via Supabase Edge Functions
 *
 * @see docs/roadmap/P0-IMPLEMENTATION-PLAN.md#p0-1
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface ValidateRequest {
  code: string;
}

interface ValidateResponse {
  valid: boolean;
  error?: string;
}

serve(async (req: Request): Promise<Response> => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ valid: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json() as ValidateRequest;
    const providedCode = body.code?.trim().toLowerCase();

    if (!providedCode) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get registration code from environment (Supabase Secret)
    const expectedCode = Deno.env.get('REGISTRATION_CODE')?.trim().toLowerCase();

    if (!expectedCode) {
      console.error('REGISTRATION_CODE not configured in Supabase Secrets');
      return new Response(
        JSON.stringify({ valid: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate code
    const isValid = providedCode === expectedCode;

    const response: ValidateResponse = {
      valid: isValid,
      ...(isValid ? {} : { error: 'Invalid registration code' }),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error validating registration code:', error);
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
