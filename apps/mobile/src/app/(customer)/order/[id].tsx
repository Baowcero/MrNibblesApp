import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api, errorText } from "@/lib/api";
import { useQuery } from "@/lib/use-query";
import {
  formatDate,
  formatDateTime,
  formatNaira,
  titleCase,
} from "@/lib/format";
import { payWithPaystack, verifyPayment, waitForPayment } from "@/lib/pay";
import { PayBox } from "@/components/pay-box";
import {
  buildSteps,
  LivePill,
  TERMINAL,
  TrackTimeline,
  type Ev,
} from "@/components/tracking";
import {
  Badge,
  Body,
  Button,
  Card,
  Choice,
  Divider,
  ErrorNote,
  H2,
  Icon,
  Input,
  Loading,
  ORDER_STATUS,
  Row,
  Screen,
  TopBar,
} from "@/components/ui";
import { color, font, tnum } from "@/theme";

interface Detail {
  id: string;
  order_no: string;
  status: string;
  fulfilment: "delivery" | "pickup";
  delivery_date: string;
  location: { label: string; address: string; area: string } | null;
  items: {
    product_id: string;
    name: string;
    quantity: number;
    unit_price_kobo: number;
    line_total_kobo: number;
  }[];
  subtotal_kobo: number;
  paystack_fee_kobo: number;
  total_kobo: number;
  savings_kobo: number;
  payment: { method: "paystack" | "office_cash"; status: string } | null;
  timeline: Ev[];
}
const CAN_REPORT = [
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "ready",
  "collected",
];
const ISSUES = [
  { v: "missing", l: "Missing bread" },
  { v: "damaged", l: "Damaged bread" },
  { v: "wrong_quantity", l: "Wrong quantity" },
  { v: "other", l: "Something else" },
];
const POLL_MS = 8000;

/** What the dark card at the top says, by where the order is. */
function hero(o: Detail): { kicker: string; big: string; line: string } {
  const when = (s: string) => {
    const e = o.timeline.find((t) => t.status === s);
    return e ? formatDateTime(e.at) : "";
  };
  const day = formatDate(o.delivery_date);
  switch (o.status) {
    case "placed":
      return {
        kicker: "Waiting for payment",
        big: formatNaira(o.total_kobo),
        line:
          o.payment?.method === "office_cash"
            ? "Bring the cash to the office and we will confirm it."
            : "Pay now to confirm your order.",
      };
    case "paid":
      return {
        kicker: "Payment received",
        big: "Order confirmed",
        line:
          o.fulfilment === "delivery"
            ? `We will assign your delivery for ${day}.`
            : `We will get it ready for ${day}.`,
      };
    case "assigned":
      return o.fulfilment === "delivery"
        ? {
            kicker: "Assigned to distributor",
            big: "Getting ready to go",
            line: `A distributor has your order. It goes out on ${day}.`,
          }
        : {
            kicker: "Being prepared",
            big: "Baking and packing",
            line: `Ready for pickup on ${day}.`,
          };
    case "out_for_delivery":
      return {
        kicker: "Arriving " + day,
        big: "On the way",
        line: "Your distributor is on the road. Keep your phone close.",
      };
    case "delivered":
      return {
        kicker: "Delivered",
        big: when("delivered") || "Delivered",
        line: "Enjoy your bread!",
      };
    case "ready":
      return {
        kicker: "Pickup " + day,
        big: "Ready for pickup",
        line: "Come to the bakery to collect your order.",
      };
    case "collected":
      return {
        kicker: "Collected",
        big: when("collected") || "Collected",
        line: "Thank you for your order!",
      };
    case "delivery_failed":
      return {
        kicker: "Not delivered",
        big: "Delivery failed",
        line: "We could not deliver this order. We will be in touch.",
      };
    default:
      return { kicker: titleCase(o.status), big: o.order_no, line: "" };
  }
}

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery<Detail>(id ? `orders/${id}` : null);
  const o = q.data;
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The webhook can mark the order paid while this screen is open: when that happens, show the confirmation.
  const lastStatus = useRef<string | null>(null);
  useEffect(() => {
    if (!o) return;
    if (
      lastStatus.current === "placed" &&
      o.status !== "placed" &&
      o.payment?.method === "paystack"
    ) {
      router.replace({ pathname: "/payment-confirmed", params: { id: o.id } });
    }
    lastStatus.current = o.status;
  }, [o, router]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [type, setType] = useState("damaged");
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");

  // Live tracking: while the order is still moving and this screen is open, check for changes every few seconds.
  const live = !!o && !TERMINAL.includes(o.status);
  const refresh = q.refresh;
  useFocusEffect(
    useCallback(() => {
      if (!live) return;
      const t = setInterval(() => {
        void refresh();
      }, POLL_MS);
      return () => clearInterval(t);
    }, [live, refresh]),
  );

  async function run(name: string, fn: () => Promise<string | void>) {
    setBusy(name);
    setMsg(null);
    try {
      const text = await fn();
      if (text) setMsg({ text });
      await q.reload();
    } catch (e) {
      setMsg({ text: errorText(e), bad: true });
    } finally {
      setBusy(null);
    }
  }

  const goConfirmed = () =>
    router.replace({ pathname: "/payment-confirmed", params: { id: id! } });
  const unpaid =
    !!o && o.status === "placed" && o.payment?.status !== "succeeded";
  const payOnline = () =>
    run("pay", async () => {
      if (await payWithPaystack(id!)) {
        goConfirmed();
        return;
      }
      // Paystack can take a few seconds to confirm: ask the server again a few times before giving up.
      setChecking(true);
      const ok = await waitForPayment(id!, () => !alive.current);
      setChecking(false);
      if (ok) {
        goConfirmed();
        return;
      }
      return 'Paystack has not confirmed your payment yet. If you have paid, tap "I have paid, check now" in a moment.';
    });
  const checkPaid = () =>
    run("check", async () => {
      setChecking(true);
      try {
        if (await verifyPayment(id!)) {
          goConfirmed();
          return;
        }
      } finally {
        setChecking(false);
      }
      return "Paystack has not confirmed a payment for this order yet. If you just paid, wait a few seconds and try again.";
    });
  const switchMethod = (m: "paystack" | "office_cash") =>
    run("switch", async () => {
      await api(`orders/${id}/payment-method`, { body: { payment_method: m } });
      return m === "office_cash"
        ? "Okay. Pay cash at the office and we will mark it paid."
        : undefined;
    });
  const report = () =>
    run("report", async () => {
      await api(`orders/${id}/issues`, {
        body: {
          issue_type: type,
          ...(type !== "other" && count
            ? { quantity: Math.round(Number(count)) }
            : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      setReporting(false);
      setNote("");
      setCount("");
      return "Thank you. We have your report and will get back to you.";
    });

  const h = o ? hero(o) : null;
  const st = o ? ORDER_STATUS[o.status] : undefined;

  return (
    <Screen onRefresh={q.reload} refreshing={q.loading && !!o}>
      <TopBar title={o?.order_no} right={live ? <LivePill /> : undefined} />
      {q.error && !o ? (
        <ErrorNote message={q.error} onRetry={q.reload} />
      ) : !o || !h ? (
        <Loading />
      ) : (
        <>
          <View
            style={{
              backgroundColor: color.side,
              borderRadius: 24,
              padding: 22,
              overflow: "hidden",
              gap: 6,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: -60,
                right: -50,
                width: 190,
                height: 190,
                borderRadius: 95,
                backgroundColor:
                  o.status === "delivery_failed" ? color.bad : color.orange,
                opacity: 0.2,
              }}
            />
            <View
              style={{
                position: "absolute",
                bottom: -80,
                left: -60,
                width: 200,
                height: 200,
                borderRadius: 100,
                backgroundColor: color.brand,
                opacity: 0.25,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                alignSelf: "flex-start",
                backgroundColor: "rgba(255,255,255,0.12)",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor:
                    st?.tone === "ok"
                      ? "#5fd3a0"
                      : st?.tone === "bad"
                        ? "#ff8a8a"
                        : color.orange,
                }}
              />
              <Text
                style={{ fontFamily: font.bold, fontSize: 12.5, color: "#fff" }}
              >
                {st?.label ?? titleCase(o.status)}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: font.semi,
                fontSize: 14,
                color: "#c9d5f2",
                marginTop: 10,
              }}
            >
              {h.kicker}
            </Text>
            <Text
              style={[
                {
                  fontFamily: font.display,
                  fontSize: 34,
                  lineHeight: 40,
                  color: "#fff",
                  letterSpacing: -0.8,
                },
                tnum,
              ]}
            >
              {h.big}
            </Text>
            {h.line ? (
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 14.5,
                  lineHeight: 21,
                  color: "#dbe4fa",
                }}
              >
                {h.line}
              </Text>
            ) : null}
          </View>

          {msg ? (
            msg.bad ? (
              <ErrorNote message={msg.text} />
            ) : (
              <Card tone="brand">
                <Body>{msg.text}</Body>
              </Card>
            )
          ) : null}

          {unpaid && o.payment && (
            <PayBox
              orderNo={o.order_no}
              totalKobo={o.total_kobo}
              method={o.payment.method}
              busy={busy}
              checking={checking}
              onPay={payOnline}
              onCheck={checkPaid}
              onSwitch={() =>
                switchMethod(
                  o.payment?.method === "paystack" ? "office_cash" : "paystack",
                )
              }
            />
          )}

          {o.status !== "placed" && (
            <Card style={{ gap: 16 }}>
              <Row>
                <H2>Order progress</H2>
                {live ? (
                  <Text
                    style={{
                      fontFamily: font.body,
                      fontSize: 12.5,
                      color: color.muted,
                    }}
                  >
                    Updates automatically
                  </Text>
                ) : null}
              </Row>
              <TrackTimeline
                steps={buildSteps(o.status, o.fulfilment, o.timeline)}
              />
            </Card>
          )}

          {o.location && (
            <Card style={{ flexDirection: "row", gap: 12 }}>
              <Icon name="map-pin" size={18} tint={color.brand} />
              <View style={{ flex: 1, gap: 2 }}>
                <H2>Delivering to</H2>
                <Body>
                  {o.location.address}, {o.location.area}
                </Body>
              </View>
            </Card>
          )}

          <Card style={{ gap: 10 }}>
            <H2>Items</H2>
            {o.items.map((i) => (
              <Row key={i.product_id}>
                <Body>
                  {i.quantity} × {i.name}
                </Body>
                <Body style={tnum}>{formatNaira(i.line_total_kobo)}</Body>
              </Row>
            ))}
            {o.paystack_fee_kobo > 0 && (
              <Row>
                <Body muted>Online payment fee</Body>
                <Body muted style={tnum}>
                  {formatNaira(o.paystack_fee_kobo)}
                </Body>
              </Row>
            )}
            <Divider />
            <Row>
              <H2>Total</H2>
              <Text
                style={[
                  { fontFamily: font.display, fontSize: 24, color: color.navy },
                  tnum,
                ]}
              >
                {formatNaira(o.total_kobo)}
              </Text>
            </Row>
            {o.payment ? (
              <Row style={{ justifyContent: "flex-start" }}>
                <Badge
                  text={`${o.payment.method === "paystack" ? "Online" : "Cash"} · ${o.payment.status === "succeeded" ? "Paid" : titleCase(o.payment.status)}`}
                  tone={o.payment.status === "succeeded" ? "ok" : "warn"}
                />
              </Row>
            ) : null}
          </Card>

          {CAN_REPORT.includes(o.status) &&
            (reporting ? (
              <Card style={{ gap: 12 }}>
                <H2>Report a problem</H2>
                {ISSUES.map((x) => (
                  <Choice
                    key={x.v}
                    label={x.l}
                    on={type === x.v}
                    onPress={() => setType(x.v)}
                  />
                ))}
                {type !== "other" && (
                  <Input
                    label="How many loaves"
                    value={count}
                    onChangeText={setCount}
                    keyboardType="number-pad"
                  />
                )}
                <Input
                  label={
                    type === "other"
                      ? "Tell us what happened"
                      : "Note (optional)"
                  }
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={500}
                />
                <Button
                  title="Send report"
                  onPress={report}
                  busy={busy === "report"}
                  disabled={type === "other" ? note.trim().length < 3 : !count}
                />
                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setReporting(false)}
                />
              </Card>
            ) : (
              <Button
                title="Something wrong? Report a problem"
                variant="secondary"
                icon="alert-circle"
                onPress={() => setReporting(true)}
              />
            ))}
        </>
      )}
    </Screen>
  );
}
