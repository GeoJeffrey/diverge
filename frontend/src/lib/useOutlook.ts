import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OutlookModelResponse, TickerOutlookResponse } from "@/types/api";

/** Outlook + model card for a ticker. Failures leave the values null so the rest of the page still renders. */
export function useOutlook(symbol: string): { outlook: TickerOutlookResponse | null; model: OutlookModelResponse | null } {
  const [outlook, setOutlook] = useState<TickerOutlookResponse | null>(null);
  const [model, setModel] = useState<OutlookModelResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setOutlook(null);
    api.outlook(symbol).then((o) => !cancelled && setOutlook(o)).catch(() => undefined);
    api.outlookModel().then((m) => !cancelled && setModel(m)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  return { outlook, model };
}
