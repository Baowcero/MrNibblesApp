import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, errorText } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useQuery } from "@/lib/use-query";
import { formatDate, formatNaira, randomKey } from "@/lib/format";
import { payWithPaystack, verifyPayment, waitForPayment } from "@/lib/pay";
import {
  Body,
  Button,
  Card,
  Choice,
  Divider,
  ErrorNote,
  H2,
  Icon,
  Loading,
  Row,
  Screen,
  TopBar,
} from "@/components/ui";
import { color, font, tnum } from "@/theme";

interface Booking {
  delivery_date: string;
  is_same_day: boolean;
  delivery_window: { start: string; end: string };
}
interface Quote {
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
}
type Method = "paystack" | "office_cash";

/** Step 2 of 3: check the order and pay. The order is only created when the customer taps pay, and the progress screen only appears once it is paid. */
export default function Review() {
  const router = useRouter();
  const { user } = useSession();
  const p = useLocalSearchParams<{
    items: string;
    fulfilment: "delivery" | "pickup";
    location_id?: string;
  }>();
  const items = useMemo(() => {
    try {
      return JSON.parse(p.items ?? "[]") as {
        product_id: string;
        quantity: number;
      }[];
    } catch {
      return [];
    }
  }, [p.items]);
  const fulfilment = p.fulfilment === "pickup" ? "pickup" : "delivery";
  const locationId = p.location_id || "";
  const location = user?.locations?.find((l) => l.id === locationId);
  const booking = useQuery<Booking>("booking/status");

  const [method, setMethod] = useState<Method>("paystack");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pay" | "check" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [checking, setChecking] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const key = useRef(randomKey()); // one key per order attempt: resending it can never double-order
  const created = useRef<{ id: string; method: Method } | null>(null); // set once the order exists, so a second tap never makes another

  useEffect(() => {
    if (items.length === 0) {
      setQuoteError("Your order is empty. Go back and add bread.");
      return;
    }
    setQuote(null);
    api<Quote>("orders/quote", { body: { items, payment_method: method } })
      .then((q) => {
        setQuote(q);
        setQuoteError(null);
      })
      .catch((e) => setQuoteError(errorText(e)));
  }, [items, method]);

  const toConfirmed = (id: string) => {
    router.dismissAll();
    router.push({ pathname: "/payment-confirmed", params: { id } });
  };

  async function pay() {
    setBusy("pay");
    setError(null);
    try {
      if (!created.current) {
        const order = await api<{ id: string }>("orders", {
          body: {
            items,
            payment_method: method,
            fulfilment,
            ...(fulfilment === "delivery" ? { location_id: locationId } : {}),
          },
          headers: { "Idempotency-Key": key.current },
        });
        created.current = { id: order.id, method };
      } else if (created.current.method !== method) {
        await api(`orders/${created.current.id}/payment-method`, {
          body: { payment_method: method },
        });
        created.current.method = method;
      }
      const id = created.current.id;
      if (method === "office_cash") {
        router.dismissAll();
        router.push({ pathname: "/order/[id]", params: { id } });
        return;
      }
      if (await payWithPaystack(id)) {
        toConfirmed(id);
        return;
      }
      setChecking(true); // Paystack can take a few seconds to confirm: ask again a few times before giving up
      const ok = await waitForPayment(id, () => !alive.current, 4, 3500);
      setChecking(false);
      if (ok) {
        toConfirmed(id);
        return;
      }
      setUnconfirmed(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function checkPaid() {
    if (!created.current) return;
    setBusy("check");
    setError(null);
    try {
      if (await verifyPayment(created.current.id)) {
        toConfirmed(created.current.id);
        return;
      }
      setError("Not received yet. Please wait a moment and try again.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const b = booking.data;
  const when =
    fulfilment === "delivery"
      ? b
        ? `${b.is_same_day ? "Today" : formatDate(b.delivery_date)}, ${b.delivery_window.start} to ${b.delivery_window.end}`
        : "Delivery time"
      : b
        ? `Pickup ${b.is_same_day ? "today" : `on ${formatDate(b.delivery_date)}`}`
        : "Pickup";
  const where =
    fulfilment === "delivery"
      ? location
        ? `${location.label}, ${location.area.name}`
        : ""
      : "The bakery, Ogbomoso";
  const label =
    method === "paystack"
      ? `Pay ${quote ? formatNaira(quote.total_kobo) : ""}`.trim()
      : "Place order";

  return (
    <Screen
      footer={
        <Button
          title={unconfirmed ? "Try payment again" : label}
          variant="accent"
          arrow={method === "office_cash"}
          onPress={pay}
          busy={busy === "pay"}
          disabled={!quote || !!quoteError || busy === "check"}
        />
      }
    >
      <TopBar title="Review and pay" />
      {error ? <ErrorNote message={error} /> : null}
      {checking ? (
        <Card
          tone="brand"
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <ActivityIndicator color={color.brand} />
          <Body style={{ flex: 1 }}>
            Checking with Paystack. This takes a few seconds.
          </Body>
        </Card>
      ) : null}
      {unconfirmed ? (
        <Card tone="warn" style={{ gap: 10 }}>
          <H2>We have not received your payment yet</H2>
          <Body>
            Your order is saved. If you already paid, tap the button below.
            Otherwise try the payment again.
          </Body>
          <Button
            title="I have paid"
            variant="secondary"
            onPress={checkPaid}
            busy={busy === "check"}
          />
        </Card>
      ) : null}

      {quoteError ? (
        <ErrorNote message={quoteError} />
      ) : !quote ? (
        <Loading />
      ) : (
        <Card style={{ gap: 12 }}>
          <H2>Order summary</H2>
          {quote.items.map((l) => (
            <Row key={l.product_id}>
              <Body muted>
                {l.name} × {l.quantity}
              </Body>
              <Body style={[{ fontFamily: font.bold }, tnum]}>
                {formatNaira(l.line_total_kobo)}
              </Body>
            </Row>
          ))}
          <Divider />
          <Row>
            <Body muted>Subtotal</Body>
            <Body style={[{ fontFamily: font.bold }, tnum]}>
              {formatNaira(quote.subtotal_kobo)}
            </Body>
          </Row>
          {quote.paystack_fee_kobo > 0 ? (
            <View style={{ gap: 2 }}>
              <Row>
                <Body muted>Paystack fee</Body>
                <Body style={[{ fontFamily: font.bold }, tnum]}>
                  {formatNaira(quote.paystack_fee_kobo)}
                </Body>
              </Row>
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 13,
                  color: color.muted,
                }}
              >
                Charged by Paystack and paid by you.
              </Text>
            </View>
          ) : null}
          <Divider />
          <Row>
            <H2>Total</H2>
            <Text
              style={[
                {
                  fontFamily: font.display,
                  fontSize: 28,
                  color: color.navy,
                  letterSpacing: -0.6,
                },
                tnum,
              ]}
            >
              {formatNaira(quote.total_kobo)}
            </Text>
          </Row>
        </Card>
      )}

      <Card
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 16,
        }}
      >
        <Icon name="clock" size={22} tint={color.brand} />
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: font.bold, fontSize: 16.5, color: color.navy }}
          >
            {when}
          </Text>
          {where ? (
            <Text
              style={{
                fontFamily: font.body,
                fontSize: 14,
                color: color.muted,
                marginTop: 1,
              }}
            >
              {where}
            </Text>
          ) : null}
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <Text
          style={{ fontFamily: font.semi, fontSize: 13.5, color: color.navy }}
        >
          How will you pay?
        </Text>
        <Choice
          icon="credit-card"
          label="Card or bank transfer"
          sub="Secure payment with Paystack"
          on={method === "paystack"}
          onPress={() => setMethod("paystack")}
        />
        <Choice
          icon="briefcase"
          label="Cash at office"
          sub="No fee. Pay at the bakery office."
          on={method === "office_cash"}
          onPress={() => setMethod("office_cash")}
        />
      </View>

      {quote ? (
        <Card tone="orange" style={{ padding: 16 }}>
          <Body style={{ fontSize: 14.5 }}>
            You will earn {formatNaira(quote.savings_kobo)} savings on this
            order.
            {method === "paystack"
              ? " Paid orders cannot be cancelled or refunded."
              : ""}
          </Body>
        </Card>
      ) : null}
    </Screen>
  );
}
