import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export function useSharedEvolution() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const response = await api.get('/settings/evolution/shared');
        const data = response.data;
        if (!data) {
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