import { useCallback, useEffect, useState } from "react";

import { fetchMapServices, type MapServiceMarker } from "@/lib/map-services-api";

const POLL_INTERVAL_MS = 60_000;

export function useMapServices() {
  const [services, setServices] = useState<MapServiceMarker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      const loaded = await fetchMapServices();
      setServices(loaded);
      setError(null);
    } catch (loadError) {
      if (!options?.silent) {
        setServices([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Servisy na mape sa nepodarilo načítať.",
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
  }, [reload]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void reload({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [reload]);

  return { services, isLoading, error, reload };
}
