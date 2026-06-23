import { useCallback, useEffect, useMemo, useState } from "react";

import {
  loadSeenHistoryNotificationIds,
  markHistoryNotificationSeen,
} from "@/lib/driver-history-notifications-storage";
import {
  countHistoryTabNotifications,
  isUnseenHistoryClosureNotification,
} from "@/lib/driver-request-notifications";
import type { DriverRequestSummary } from "@/lib/driver-requests-api";

export function useDriverHistoryNotifications(requests: DriverRequestSummary[]) {
  const [seenRequestIds, setSeenRequestIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;

    void loadSeenHistoryNotificationIds().then((ids) => {
      if (!cancelled) {
        setSeenRequestIds(ids);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const historyTabPendingCount = useMemo(
    () => countHistoryTabNotifications(requests, seenRequestIds),
    [requests, seenRequestIds],
  );

  const hasUnseenHistoryNotification = useCallback(
    (request: DriverRequestSummary) =>
      isUnseenHistoryClosureNotification(request, seenRequestIds),
    [seenRequestIds],
  );

  const acknowledgeHistoryNotification = useCallback(async (requestId: string) => {
    const trimmed = requestId.trim();
    if (!trimmed) {
      return;
    }

    setSeenRequestIds((current) => {
      if (current.has(trimmed)) {
        return current;
      }
      const next = new Set(current);
      next.add(trimmed);
      return next;
    });

    await markHistoryNotificationSeen(trimmed);
  }, []);

  return {
    historyTabPendingCount,
    hasUnseenHistoryNotification,
    acknowledgeHistoryNotification,
  };
}
