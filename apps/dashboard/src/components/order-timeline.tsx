import { Icon } from '@/components/icons';
import { formatDateTime } from '@/lib/format';

export interface OrderEvent { status: string; at: string; note: string | null }
export interface Step { key: string; label: string; state: 'done' | 'current' | 'todo' | 'failed'; at?: string; note?: string | null; hint?: string }

const DELIVERY = ['placed', 'paid', 'assigned', 'out_for_delivery', 'delivered'];
const PICKUP = ['placed', 'paid', 'assigned', 'ready', 'collected'];
// Steps are named for what happened, not for the order's status at that moment, so "placed" never reads as "awaiting payment" after the customer has paid.
const LABEL: Record<string, string> = {
  placed: 'Order placed', paid: 'Payment received', assigned: 'Assigned to distributor', out_for_delivery: 'Out for delivery',
  delivered: 'Delivered', ready: 'Ready for pickup', collected: 'Collected', delivery_failed: 'Delivery failed',
};
const HINT: Record<string, string> = {
  paid: 'Waiting for payment', assigned: 'Not assigned yet', out_for_delivery: 'Not started', delivered: 'Not delivered yet', ready: 'Not ready yet', collected: 'Not collected yet',
};

export function buildSteps(status: string, fulfilment: 'delivery' | 'pickup', events: OrderEvent[], distributor?: string | null): Step[] {
  const sorted = [...events].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  const first = new Map<string, OrderEvent>();
  for (const e of sorted) if (!first.has(e.status)) first.set(e.status, e);

  const failed = status === 'delivery_failed';
  const flow = [...(fulfilment === 'pickup' ? PICKUP : DELIVERY)];
  if (fulfilment === 'pickup') LABEL.assigned = 'Being prepared'; else LABEL.assigned = 'Assigned to distributor';
  if (failed) flow[flow.length - 1] = 'delivery_failed';
  let idx = failed ? flow.length - 1 : flow.indexOf(status);
  if (idx < 0) idx = Math.max(0, ...sorted.map((e) => flow.indexOf(e.status)));
  const terminal = status === 'delivered' || status === 'collected';

  return flow.map((key, i) => {
    const ev = first.get(key);
    const state: Step['state'] = failed && i === flow.length - 1 ? 'failed' : i < idx ? 'done' : i === idx ? (terminal ? 'done' : 'current') : 'todo';
    const who = key === 'assigned' && distributor && state !== 'todo' ? `To ${distributor}` : null;
    return { key, label: LABEL[key] ?? key, state, at: ev?.at, note: [who, ev?.note].filter(Boolean).join(' · ') || null, hint: state === 'todo' ? HINT[key] : undefined };
  });
}

export function OrderTimeline({ status, fulfilment, events, distributor }: { status: string; fulfilment: 'delivery' | 'pickup'; events: OrderEvent[]; distributor?: string | null }) {
  const steps = buildSteps(status, fulfilment, events, distributor);
  return (
    <ol>
      {steps.map((st, i) => {
        const last = i === steps.length - 1;
        const next = steps[i + 1];
        const lineOn = !!next && next.state !== 'todo';
        const todo = st.state === 'todo';
        return (
          <li key={st.key} className="flex gap-3">
            <div className="flex w-6 shrink-0 flex-col items-center">
              {st.state === 'done' ? <span className="grid size-6 place-items-center rounded-full bg-side-2 text-white"><Icon name="check" size={13} /></span>
                : st.state === 'failed' ? <span className="grid size-6 place-items-center rounded-full bg-bad text-white"><Icon name="close" size={13} /></span>
                : st.state === 'current' ? <span className="relative grid size-6 place-items-center"><span className="absolute size-6 animate-ping rounded-full bg-orange/30" /><span className="size-3.5 rounded-full bg-orange" /></span>
                : <span className="size-6 rounded-full border-2 border-line bg-white" />}
              {!last && <span className={`my-1 w-0.5 flex-1 ${lineOn ? 'bg-side-2' : 'bg-line'}`} />}
            </div>
            <div className={`min-h-6 flex-1 text-sm ${last ? '' : 'pb-5'}`}>
              <p className={`font-semibold ${todo ? 'text-muted' : st.state === 'failed' ? 'text-bad' : 'text-navy'}`}>{st.label}</p>
              {st.at ? <p className="text-xs text-muted">{formatDateTime(st.at)}{st.note ? ` · ${st.note}` : ''}</p> : st.hint ? <p className="text-xs text-muted/70">{st.hint}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
