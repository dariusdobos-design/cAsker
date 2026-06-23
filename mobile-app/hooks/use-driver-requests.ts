import { useCallback, useEffect, useMemo, useState } from "react";

import { loadCustomerRequestIds, syncCustomerRequestIds } from "@/lib/customer-request-ids";
import {
  countPendingServiceResponses,
  countReceivedTabNotifications,
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
      if (ids.length === 0) {
        setRequests([]);
        return;
      }

      const loaded = await fetchMyDriverRequests(ids);
      await syncCustomerRequestIds(loaded.map((request) => request.id));
      setRequests(loaded);
    } catch (error) {
      if (!options?.silent) {
        setRequests([]);
      }
      if (__DEV__) {
        console.warn(
          "Dopyty sa nepodarilo načítať:",
          error instanceof Error ? error.message : error,
        );
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

  const receivedTabPendingCount = useMemo(
    () => countReceivedTabNotifications(requests),
    [requests],
  );

  return {
    requests,
    isLoading,
    reload,
    pendingResponseCount,
    receivedTabPendingCount,
    unreadChatCount,
  };
}
