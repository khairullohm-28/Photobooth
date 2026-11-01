/**
 * Supabase Edge Function: cleanup-expired
 * Triggered hourly via pg_cron or HTTP schedule with SERVICE_ROLE_KEY.
 * Deletes expired session assets from Supabase Storage bucket AND deletes
 * corresponding rows in sessions & session_assets tables.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing service role configuration' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const nowIso = new Date().toISOString();

    // 1. Find all expired sessions
    const { data: expiredSessions, error: findError } = await supabase
      .from('sessions')
      .select('id, expires_at')
      .lt('expires_at', nowIso);

    if (findError) throw findError;

    if (!expiredSessions || expiredSessions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired sessions found', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const expiredIds = expiredSessions.map((s) => s.id);

    // 2. Query all assets belonging to expired sessions
    const { data: assets, error: assetErr } = await supabase
      .from('session_assets')
      .select('id, session_id, url')
      .in('session_id', expiredIds);

    if (assetErr) throw assetErr;

    // 3. Remove files from Supabase Storage bucket
    const filePathsToDelete: string[] = [];
    if (assets) {
      for (const asset of assets) {
        if (asset.url && asset.url.includes('/storage/v1/object/public/photobooth/')) {
          const path = asset.url.split('/storage/v1/object/public/photobooth/')[1];
          if (path) filePathsToDelete.push(decodeURIComponent(path));
        }
      }
    }

    if (filePathsToDelete.length > 0) {
      await supabase.storage.from('photobooth').remove(filePathsToDelete);
    }

    // 4. Delete the sessions (CASCADE removes session_assets rows)
    const { error: deleteErr } = await supabase
      .from('sessions')
      .delete()
      .in('id', expiredIds);

    if (deleteErr) throw deleteErr;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleaned up expired photobooth sessions and storage files',
        deleted_sessions_count: expiredIds.length,
        deleted_files_count: filePathsToDelete.length,
        timestamp: nowIso,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
