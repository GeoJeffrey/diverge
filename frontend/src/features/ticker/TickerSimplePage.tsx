import { useParams } from "react-router";
import { useOutlook, useOutlookModel, errorMessage } from "@/lib/queries";
import { ErrorBlock, Skeleton } from "@/design-system/components/States";
import { OutlookPanel } from "@/features/outlook/OutlookPanel";
import { TickerHeader } from "./TickerHeader";
import { NarrativeAside } from "./NarrativeAside";
import { tickerMeta } from "@/lib/markets";
import NotFoundPage from "@/features/system/NotFoundPage";

export default function TickerSimplePage() {
  const symbol = (useParams().symbol ?? "").toUpperCase();
  const outlook = useOutlook(symbol);
  const model = useOutlookModel();
  if (!tickerMeta(symbol)) return <NotFoundPage what={`Diverge doesn't track “${symbol}”.`} />;

  return (
    <div className="page">
      <TickerHeader symbol={symbol} view="simple" />
      <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,3.4fr)] lg:gap-16">
        <div>
          {outlook.isPending && <Skeleton className="h-[560px]" label="Loading the outlook" />}
          {outlook.isError && <ErrorBlock message={errorMessage(outlook.error)} onRetry={() => void outlook.refetch()} />}
          {outlook.data && <OutlookPanel o={outlook.data} model={model.data} animate />}
        </div>
        <NarrativeAside symbol={symbol} />
      </div>
    </div>
  );
}
