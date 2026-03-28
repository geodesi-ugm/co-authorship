import { useState, useEffect } from 'react';
import { fetchDashboardData, DashboardData } from '../lib/data';

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchDashboardData()
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setError(e);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
