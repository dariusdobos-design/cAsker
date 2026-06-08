import { useCallback, useEffect, useMemo, useState } from "react";

import { loadCustomerRequestIds, syncCustomerRequestIds } from "@/lib/customer-request-ids";
import {
  countPendingServiceResponses,
  countUnreadChatMessages,
} from "@/lib/driver-request-notifications";
import { fetchMyDriverRequests, type DriverRequestSummary } from "@/lib/driver-requests-api";

const POLL_INTERVAL_MS = 8000;

export function useDriverRequests(refreshKey = 0) {
  const [requests, setRequests] = useState<DriverRequestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      const ids = await loadCustomerRequestIds();
      const loaded = await fetchMyDriverRequests(ids);
      await syncCustomerRequestIds(loaded.map((request) => request.id));
      setRequests(loaded);
    } catch {
      if (!options?.silent) {
        setRequests([]);
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [refreshKey, reload]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void reload({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [reload]);

  const pendingResponseCount = useMemo(
    () => countPendingServiceResponses(requests),
    [requests],
  );

  const unreadChatCount = useMemo(() => countUnreadChatMessages(requests), [requests]);

  return {
    requests,
    isLoading,
    reload,
    pendingResponseCount,
    unreadChatCount,
  };
}
