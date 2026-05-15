import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function parseUA(ua: string) {
  const u = ua.toLowerCase();
  let device = "desktop";
  if (/mobile|android|iphone|ipad/.test(u)) device = /ipad|tablet/.test(u) ? "tablet" : "mobile";
  let browser = "Outro";
  if (u.includes("edg/")) browser = "Edge";
  else if (u.includes("chrome/")) browser = "Chrome";
  else if (u.includes("firefox/")) browser = "Firefox";
  else if (u.includes("safari/")) browser = "Safari";
  let os = "Outro";
  if (u.includes("windows")) os = "Windows";
  else if (u.includes("mac os")) os = "macOS";
  else if (u.includes("android")) os = "Android";
  else if (u.includes("iphone") || u.includes("ipad") || u.includes("ios")) os = "iOS";
  else if (u.includes("linux")) os = "Linux";
  return { device, browser, os };
}

function detectSource(referrer: string, utmSource: string | null): string | null {
  if (utmSource) return utmSource;
  if (!referrer) return null;
  const r = referrer.toLowerCase();
  if (r.includes("instagram")) return "instagram";
  if (r.includes("tiktok")) return "tiktok";
  if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
  if (r.includes("whatsapp") || r.includes("wa.me")) return "whatsapp";
  if (r.includes("youtube")) return "youtube";
  if (r.includes("twitter") || r.includes("x.com")) return "twitter";
  if (r.includes("linkedin")) return "linkedin";
  if (r.includes("google")) return "google";
  return "outro";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { slug, referrer = "", utm_source = null, utm_medium = null, utm_campaign = null } = body;

    if (!slug) {
      return new Response(JSON.stringify({ error: "slug required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const ua = req.headers.get("user-agent") || "";
    const { device, browser, os } = parseUA(ua);
    const source = detectSource(referrer, utm_source);

    let country: string | null = null, country_code: string | null = null;
    let city: string | null = null, region: string | null = null;
    if (ip) {
      try {
        const geoResp = await fetch(`https://ipapi.co/${ip}/json/`);
        if (geoResp.ok) {
          const g = await geoResp.json();
          country = g.country_name || null;
          country_code = g.country_code || null;
          city = g.city || null;
          region = g.region || null;
        }
      } catch (_) {}
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase.rpc("register_link_click", {
      p_slug: slug,
      p_ip: ip,
      p_country: country,
      p_country_code: country_code,
      p_city: city,
      p_region: region,
      p_device: device,
      p_browser: browser,
      p_os: os,
      p_referrer: referrer || null,
      p_utm_source: source,
      p_utm_medium: utm_medium,
      p_utm_campaign: utm_campaign,
      p_user_agent: ua,
    });

    if (error || !data || data.length === 0) {
      return new Response(JSON.stringify({ error: "link not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone, message } = data[0];
    const cleanPhone = String(phone).replace(/\D/g, "");
    const url = message
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/${cleanPhone}`;

    return new Response(JSON.stringify({ url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});