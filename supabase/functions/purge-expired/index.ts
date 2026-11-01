// ============================================================================
// SUPABASE EDGE FUNCTION: purge-expired
// Menghapus file foto di Storage Supabase yang masa retensinya telah habis,
// lalu menandai sessions.status = 'kedaluwarsa' dan files_deleted_at = NOW().
// Baris sessions dan session_code TETAP DIPERTAHANKAN untuk keperluan audit dan pencarian.
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // 1. Cari semua sesi aktif yang expires_at sudah lewat
    const { data: expiredSessions, error: fetchErr } = await supabase
      .from("sessions")
      .select("id, session_code")
      .eq("status", "aktif")
      .lt("expires_at", now)
      .limit(100);

    if (fetchErr) {
      throw fetchErr;
    }

    if (!expiredSessions || expiredSessions.length === 0) {
      return new Response(
        JSON.stringify({ message: "Tidak ada sesi kedaluwarsa yang perlu dipurge.", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const sessionIds = expiredSessions.map((s) => s.id);

    // 2. Dapatkan URL aset dari session_assets untuk dihapus dari Storage
    const { data: assets, error: assetsErr } = await supabase
      .from("session_assets")
      .select("url")
      .in("session_id", sessionIds);

    if (!assetsErr && assets && assets.length > 0) {
      const storageFilePaths: string[] = [];

      for (const asset of assets) {
        // Ekstrak path file dari URL jika tersimpan di bucket storage photobooth/frames/sessions
        try {
          const urlObj = new URL(asset.url);
          const pathSegments = urlObj.pathname.split("/storage/v1/object/public/");
          if (pathSegments.length > 1) {
            const bucketAndPath = pathSegments[1];
            const firstSlash = bucketAndPath.indexOf("/");
            const bucket = bucketAndPath.substring(0, firstSlash);
            const filePath = bucketAndPath.substring(firstSlash + 1);
            if (bucket === "sessions" || bucket === "photobooth") {
              storageFilePaths.push(filePath);
            }
          }
        } catch {
          // Abaikan bila data URL base64 lokal
        }
      }

      if (storageFilePaths.length > 0) {
        await supabase.storage.from("sessions").remove(storageFilePaths);
      }
    }

    // 3. Hapus data session_assets file
    await supabase.from("session_assets").delete().in("session_id", sessionIds);

    // 4. Update status session menjadi 'kedaluwarsa' dan catat waktu penghapusan
    const { error: updateErr } = await supabase
      .from("sessions")
      .update({
        status: "kedaluwarsa",
        files_deleted_at: now,
      })
      .in("id", sessionIds);

    if (updateErr) {
      throw updateErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Berhasil mempurge ${sessionIds.length} sesi kedaluwarsa.`,
        purged_sessions: expiredSessions.map((s) => s.session_code),
        count: sessionIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
