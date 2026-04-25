import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSharedEvolution() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const { data, error } = await (supabase as any).rpc('get_shared_evolution');
        if (error || !data) {
          setEnabled(false);
        } else {
          const v = data as { enabled?: boolean };
          setEnabled(!!v.enabled);
        }
      } catch {
        setEnabled(false);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, []);

  return loading ? false : enabled;
}