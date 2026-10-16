import { useEffect, useState } from "react";
import api, { apiError } from "../../api/api";
import { currentMonth, dashboardPayload } from "./model";
import type { DashboardData } from "./model";
export function useDashboard(allowed: boolean, ownerId: number) {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataOwner, setDataOwner] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setLoading(false);
    if (allowed && ownerId > 0) {
      setLoading(true);
      void (async () => {
        try {
          const raw = (
            await api.get(`/dashboard/organizacao?mes=${month}`, {
              signal: controller.signal,
            })
          ).data;
          if (!controller.signal.aborted) {setData(dashboardPayload(raw, month)); setDataOwner(ownerId);}
        } catch (cause) {
          if (!controller.signal.aborted) setError(apiError(cause));
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }
    return () => controller.abort();
  }, [allowed, ownerId, month, revision]);
  return {
    month,
    setMonth,
    data: dataOwner === ownerId && data?.mes === month ? data : null,
    loading,
    error,
    refresh: () => setRevision((r) => r + 1),
  };
}
