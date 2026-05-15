import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function LinkRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("link-redirect", {
          body: {
            slug,
            referrer: document.referrer,
            utm_source: searchParams.get("utm_source"),
            utm_medium: searchParams.get("utm_medium"),
            utm_campaign: searchParams.get("utm_campaign"),
          },
        });
        if (error || !data?.url) {
          setError("Link não encontrado ou inativo.");
          return;
        }
        window.location.replace(data.url);
      } catch (e) {
        setError("Erro ao redirecionar. Tente novamente.");
      }
    })();
  }, [slug, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="glass-card p-8 max-w-sm text-center space-y-3">
          <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
          <h1 className="font-bold">Ops!</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Abrindo WhatsApp...</p>
    </div>
  );
}