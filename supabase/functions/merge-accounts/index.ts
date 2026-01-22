/**
 * Edge Function: merge-accounts
 *
 * Merges an anonymous user's data into an existing authenticated account.
 * Used when an anonymous user registers with an email that already exists.
 *
 * Flow:
 * 1. Anonymous user tries to register with existing email
 * 2. Frontend detects conflict and offers merge option
 * 3. User authenticates with existing account
 * 4. This function transfers all data from anon → existing
 * 5. Anonymous account is deleted
 *
 * Security:
 * - Requires valid JWT from the TARGET account (existing user)
 * - Anon user ID must be provided and valid
 * - All data operations wrapped in atomic PostgreSQL transaction via merge_user_data()
 *
 * @see supabase/migrations/20260122_merge_user_data_function.sql
 *
 * @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md - Section on Merge & Claim
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface MergeRequest {
  /** The anonymous user ID whose data should be transferred */
  anonymousUserId: string;
}

interface MergeResponse {
  success: boolean;
  /** Number of tournaments transferred */
  tournamentsMerged?: number;
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
        JSON.stringify({ success: false, error: 'Method not allowed' } as MergeResponse),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the authorization header (JWT from the target/existing user)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' } as MergeResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' } as MergeResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client with user JWT - to verify the target user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client for data operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the calling user (target account)
    const { data: { user: targetUser }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !targetUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' } as MergeResponse),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Target user must NOT be anonymous
    if (targetUser.is_anonymous) {
      return new Response(
        JSON.stringify({ success: false, error: 'Target account cannot be anonymous' } as MergeResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json() as MergeRequest;
    const { anonymousUserId } = body;

    if (!anonymousUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'anonymousUserId is required' } as MergeResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the anonymous user exists and IS anonymous
    const { data: anonUserData, error: anonError } = await supabaseAdmin.auth.admin.getUserById(anonymousUserId);

    if (anonError || !anonUserData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Anonymous user not found' } as MergeResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!anonUserData.user.is_anonymous) {
      return new Response(
        JSON.stringify({ success: false, error: 'Source user is not anonymous' } as MergeResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ================================================================
    // MERGE DATA: Transfer all resources from anonymous to target user
    // Uses atomic PostgreSQL function for transaction safety
    // ================================================================

    // Call the merge_user_data function (runs in a single transaction)
    const { data: mergeResult, error: mergeError } = await supabaseAdmin
      .rpc('merge_user_data', {
        p_source_user_id: anonymousUserId,
        p_target_user_id: targetUser.id,
      });

    if (mergeError) {
      console.error('Error in merge_user_data:', mergeError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to merge account data. Transaction rolled back.',
        } as MergeResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the anonymous auth user (must be done via Admin API, not SQL)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(anonymousUserId);

    if (deleteUserError) {
      console.error('Warning: Error deleting anonymous auth user:', deleteUserError);
      // Data is already transferred - don't fail the operation
      // The orphaned auth user will be cleaned up by Supabase eventually
    }

    // Extract tournament count from the merge result
    const tournamentsMerged = mergeResult?.transferred?.tournaments ?? 0;

    // Success!
    const response: MergeResponse = {
      success: true,
      tournamentsMerged,
    };

    console.log('Merge completed:', {
      sourceUser: anonymousUserId,
      targetUser: targetUser.id,
      transferred: mergeResult?.transferred,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in merge-accounts:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' } as MergeResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
