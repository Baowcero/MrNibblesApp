"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@/lib/use-query";
import { useSession } from "@/lib/session";
import {
  formatDate,
  formatNaira,
  formatNumber,
  lagosToday,
  titleCase,
} from "@/lib/format";
import { Icon } from "@/components/icons";
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  ORDER_STATUS,
  Skeleton,
  StatusBadge,
} from "@/components/ui";

interface Overview {
  date: string;
  today: {
    orders: number;
    loaves: number;
    by_status: Record<string, number>;
    payments_received: { amount_kobo: number; paystack_fees_kobo: number };
    bread_produced: number;
    runs_recorded: string[];
  };
  last_7_days: {
    date: string;
    orders: number;
    loaves: number;
    paid_kobo: number;
  }[];
  customers: {
    active: number;
    pending_approval: number;
    unclaimed: number;
    suspended: number;
  };
  attention: {
    open_issues: number;
    pending_approvals: number;
    low_stock: {
      id: string;
      name: string;
      unit: string | null;
      in_stock: number;
      reorder_level: number;
    }[];
  };
}
interface OrderRow {
  id: string;
  order_no: string;
  business_name: string;
  fulfilment: string;
  status: string;
  area: string | null;
  items: { name: string; quantity: number }[];
  bread_count: number;
  total_kobo: number;
}

const STATUS_ORDER = [
  "placed",
  "paid",
  "assigned",
  "out_for_delivery",
  "ready",
  "delivered",
  "collected",
  "delivery_failed",
];
const DOT: Record<string, string> = {
  warn: "bg-warn",
  brand: "bg-brand",
  orange: "bg-orange",
  ok: "bg-ok",
  bad: "bg-bad",
  neutral: "bg-muted",
};

/** Round a chart maximum up to a tidy number (1, 2, 2.5, 5 times a power of ten). */
function niceCeil(n: number) {
  if (n <= 0) return 100;
  const pow = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 2.5, 5, 10].find((m) => n <= m * pow) ?? 10) * pow;
}

function greeting() {
  const h = Number(
    new Date().toLocaleString("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Lagos",
    }),
  );
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const shortDay = (ymd: string) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export default function OverviewPage() {
  const { user } = useSession();
  const today = lagosToday();
  const [date, setDate] = useState(today);
  const dateInput = useRef<HTMLInputElement>(null);
  const [hello, setHello] = useState("Hello");
  useEffect(() => setHello(greeting()), []);

  const ov = useQuery<Overview>(`staff/overview?date=${date}`);
  const orders = useQuery<{ data: OrderRow[] }>(
    `staff/orders?date=${date}&limit=200`,
  );
  const d = ov.data;
  const rows = useMemo(() => orders.data?.data ?? [], [orders.data]);
  const isToday = date === today;

  // ---- numbers derived from what the API already returns
  const week = d?.last_7_days ?? [];
  const weekTotal = week.reduce((s, x) => s + x.paid_kobo, 0);
  const yesterday = week.length >= 2 ? week[week.length - 2]!.paid_kobo : 0;
  const maxK = niceCeil(
    Math.max(0, ...week.map((x) => x.paid_kobo / 100 / 1000)),
  );
  const toAssign = d?.today.by_status.paid ?? 0;

  const mix = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of rows)
      for (const i of o.items) m.set(i.name, (m.get(i.name) ?? 0) + i.quantity);
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    return { total, list: [...m.entries()].sort((a, b) => b[1] - a[1]) };
  }, [rows]);

  const alerts = d
    ? ([
        toAssign > 0 &&
          `${toAssign} paid order${toAssign === 1 ? "" : "s"} to assign`,
        d.attention.pending_approvals > 0 &&
          `${d.attention.pending_approvals} customer${d.attention.pending_approvals === 1 ? "" : "s"} awaiting approval`,
        d.attention.open_issues > 0 &&
          `${d.attention.open_issues} open issue${d.attention.open_issues === 1 ? "" : "s"}`,
        d.attention.low_stock.length > 0 &&
          `${d.attention.low_stock.length} item${d.attention.low_stock.length === 1 ? "" : "s"} low on stock`,
      ].filter(Boolean) as string[])
    : [];

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">
            {hello}
            {user ? `, ${user.full_name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            {isToday
              ? "Here is how the bakery is doing today."
              : `Here is how ${formatDate(date)} went.`}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() =>
              dateInput.current?.showPicker
                ? dateInput.current.showPicker()
                : dateInput.current?.focus()
            }
            className="flex items-center gap-3 rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold hover:bg-cream-2"
          >
            <Icon name="calendar" size={20} />
            {isToday ? "Today" : formatDate(date)} ·{" "}
            {new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })}
          </button>
          <input
            ref={dateInput}
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Choose a date"
            className="pointer-events-none absolute inset-0 opacity-0"
            tabIndex={-1}
          />
        </div>
      </div>

      {(ov.error || orders.error) && (
        <div className="mb-4">
          <ErrorNote
            message={(ov.error || orders.error)!}
            onRetry={() => {
              void ov.reload();
              void orders.reload();
            }}
          />
        </div>
      )}

      {/* live strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl bg-side px-6 py-5 text-white">
        <span className="rounded-full bg-emerald-100 px-3.5 py-1.5 text-xs font-bold tracking-wide text-emerald-900">
          {isToday ? "LIVE" : "PAST DAY"}
        </span>
        <p className="min-w-0 flex-1 text-[15px]">
          {!d
            ? "Loading…"
            : alerts.length
              ? alerts.join(" · ")
              : "Nothing needs your attention right now"}
        </p>
        <Link
          href="/orders"
          className="flex items-center gap-2 text-[15px] font-semibold hover:underline"
        >
          Open orders <Icon name="arrow" size={18} />
        </Link>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!d ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))
        ) : (
          <>
            <Kpi
              label="Payments received"
              value={formatNaira(d.today.payments_received.amount_kobo)}
              hint={
                yesterday
                  ? `Yesterday ${formatNaira(yesterday)}`
                  : "No payments yesterday"
              }
              good
            />
            <Kpi
              label="Orders"
              value={formatNumber(d.today.orders)}
              hint={`${formatNumber(d.today.by_status.delivered ?? 0)} delivered so far`}
            />
            <Kpi
              label="Loaves ordered"
              value={formatNumber(d.today.loaves)}
              hint={`${formatNumber(d.today.bread_produced)} produced`}
            />
            <Kpi
              label="Active customers"
              value={formatNumber(d.customers.active)}
              hint={`${d.customers.pending_approval} awaiting approval · ${d.customers.unclaimed} not signed up`}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* sales trend */}
        <Card className="p-7 lg:col-span-2">
          <h2 className="text-xl font-bold">Sales trend</h2>
          <p className="mt-1 text-sm text-muted">
            {d ? `${formatNaira(weekTotal)} received in the last 7 days` : " "}
          </p>
          <div className="mt-6 flex items-center justify-between text-sm text-muted">
            <span>Payments received · ₦ thousands</span>
            <span>
              {week.length
                ? `${shortDay(week[0]!.date)} – ${shortDay(week[week.length - 1]!.date)}`
                : ""}
            </span>
          </div>
          {!d ? (
            <Skeleton className="mt-4 h-64" />
          ) : (
            <div
              className="mt-4 flex gap-4"
              role="img"
              aria-label="Bar chart of payments received in each of the last 7 days"
            >
              <div className="flex h-64 flex-col justify-between pb-0.5 text-xs text-muted tnum">
                {[maxK, maxK / 2, 0].map((t) => (
                  <span key={t}>{formatNumber(t)}</span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="relative flex h-64 items-end gap-3 border-b border-line">
                  {[0, 50].map((p) => (
                    <div
                      key={p}
                      className="absolute inset-x-0 border-t border-dashed border-line"
                      style={{ bottom: `${p === 0 ? 100 : 50}%` }}
                    />
                  ))}
                  {week.map((day) => {
                    const k = day.paid_kobo / 100 / 1000;
                    const isSel = day.date === d.date;
                    return (
                      <div
                        key={day.date}
                        className="group relative z-10 flex h-full flex-1 items-end"
                        title={`${shortDay(day.date)}: ${formatNaira(day.paid_kobo)} · ${day.orders} orders`}
                      >
                        <div
                          className={`w-full rounded-t-lg ${isSel ? "bg-orange" : "bg-bar group-hover:bg-brand/40"}`}
                          style={{
                            height: `${Math.max(day.paid_kobo > 0 ? 2 : 0, (k / maxK) * 100)}%`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-3 text-xs text-muted">
                  {week.map((day) => (
                    <span key={day.date} className="flex-1 text-center">
                      {shortDay(day.date)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* order status */}
        <Card className="p-7">
          <h2 className="text-xl font-bold">Order status overview</h2>
          <p className="mt-1 text-sm text-muted">
            {d
              ? `${formatNumber(d.today.orders)} order${d.today.orders === 1 ? "" : "s"} ${isToday ? "today" : "on this day"}`
              : " "}
          </p>
          {!d ? (
            <Skeleton className="mt-6 h-64" />
          ) : (
            <ul className="mt-6 space-y-4">
              {STATUS_ORDER.map((s) => {
                const n = d.today.by_status[s] ?? 0;
                const tone = ORDER_STATUS[s]?.tone ?? "neutral";
                return (
                  <li
                    key={s}
                    className={`flex items-center gap-3 text-[15px] ${n === 0 ? "text-muted" : ""}`}
                  >
                    <span
                      className={`size-2.5 rounded-full ${n === 0 ? "bg-line" : DOT[tone]}`}
                    />
                    <span className="flex-1">
                      {ORDER_STATUS[s]?.label ?? titleCase(s)}
                    </span>
                    <span className="font-semibold tnum">{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* recent orders */}
        <Card className="p-7 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                {isToday ? "Recent orders" : "Orders"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Orders for {formatDate(date)}
              </p>
            </div>
            <Link
              href="/orders"
              className="flex items-center gap-1.5 text-sm font-semibold text-orange hover:underline"
            >
              View all <Icon name="arrow" size={16} />
            </Link>
          </div>
          {!orders.data ? (
            <Skeleton className="mt-6 h-48" />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No orders for this day"
              text="Orders appear here as customers place them."
            />
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-cream text-xs font-semibold tracking-wide text-muted uppercase">
                    <th className="rounded-l-lg px-4 py-3">Order / customer</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Fulfilment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="w-10 rounded-r-lg" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.slice(0, 5).map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-4">
                        <p className="font-bold">{o.order_no}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {o.business_name}
                          {o.area ? ` · ${o.area}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap tnum">
                        {formatNaira(o.total_kobo)}
                      </td>
                      <td className="px-4 py-4">{titleCase(o.fulfilment)}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-2 py-4">
                        <Link
                          href="/orders"
                          aria-label={`Open ${o.order_no} in orders`}
                          className="grid size-9 place-items-center rounded-full hover:bg-cream-2"
                        >
                          <Icon name="more" size={20} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* bread mix + low stock */}
        <div className="space-y-6">
          <Card className="p-7">
            <h2 className="text-xl font-bold">Bread mix</h2>
            <p className="mt-1 text-sm text-muted">
              Loaves ordered · {formatDate(date)}
            </p>
            {!orders.data ? (
              <Skeleton className="mt-6 h-32" />
            ) : mix.list.length === 0 ? (
              <p className="mt-6 text-sm text-muted">No bread ordered yet.</p>
            ) : (
              <ul className="mt-6 space-y-5">
                {mix.list.map(([name, qty], i) => (
                  <li key={name}>
                    <div className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span>{name}</span>
                      <span className="font-bold tnum">
                        {formatNumber(qty)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-cream">
                      <div
                        className={`h-2 rounded-full ${i === 0 ? "bg-side" : "bg-bar"}`}
                        style={{ width: `${(qty / mix.total) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {Math.round((qty / mix.total) * 100)}% of loaves
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {d && d.attention.low_stock.length > 0 && (
            <Card className="p-7">
              <h2 className="text-xl font-bold">Low stock</h2>
              <ul className="mt-4 space-y-3 text-[15px]">
                {d.attention.low_stock.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="capitalize">{m.name}</span>
                    <Badge tone="bad">
                      {m.in_stock} {m.unit ?? ""} left
                    </Badge>
                  </li>
                ))}
              </ul>
              <Link
                href="/inventory"
                className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-orange hover:underline"
              >
                Go to inventory <Icon name="arrow" size={16} />
              </Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint: string;
  good?: boolean;
}) {
  return (
    <Card className="p-6">
      <p className="text-[15px] text-muted">{label}</p>
      <p className="mt-3 text-4xl font-bold tnum">{value}</p>
      <p className={`mt-3 text-sm ${good ? "text-ok" : "text-muted"}`}>
        {hint}
      </p>
    </Card>
  );
}
