import { useCallback, useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@/lib/use-query";
import { formatDate, formatNaira } from "@/lib/format";
import {
  Body,
  Button,
  Card,
  Divider,
  ErrorNote,
  H2,
  Icon,
  Loading,
  Row,
  Screen,
  type IconName,
} from "@/components/ui";
import { color, font, tnum } from "@/theme";

interface Detail {
  id: string;
  order_no: string;
  status: string;
  fulfilment: "delivery" | "pickup";
  delivery_date: string;
  items: { quantity: number }[];
  total_kobo: number;
  savings_kobo: number;
  payment: { method: "paystack" | "office_cash"; status: string } | null;
}

function Receipt({
  label,
  value,
  strong,
  tint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tint?: string;
}) {
  return (
    <Row>
      <Text style={{ fontFamily: font.body, fontSize: 15, color: color.muted }}>
        {label}
      </Text>
      <Text
        style={[
          {
            fontFamily: strong ? font.display : font.bold,
            fontSize: strong ? 20 : 15,
            color: tint ?? color.navy,
          },
          tnum,
        ]}
      >
        {value}
      </Text>
    </Row>
  );
}

export default function PaymentConfirmed() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useQuery<Detail>(id ? `orders/${id}` : null);
  const o = q.data;
  const confirmed =
    !!o && (o.payment?.status === "succeeded" || o.status !== "placed");
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (confirmed)
      Animated.spring(pop, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
  }, [confirmed, pop]);
  // If Paystack has not told us yet, keep checking every few seconds until it does.
  const refresh = q.refresh;
  useFocusEffect(
    useCallback(() => {
      if (!o || confirmed) return;
      const t = setInterval(() => {
        void refresh();
      }, 4000);
      return () => clearInterval(t);
    }, [o, confirmed, refresh]),
  );

  const loaves = o?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const next: { icon: IconName; text: string }[] = o
    ? [
        { icon: "package", text: "We bake and pack your bread." },
        o.fulfilment === "delivery"
          ? { icon: "truck", text: "A distributor brings it to you." }
          : {
              icon: "shopping-bag",
              text: "We tell you when it is ready to collect.",
            },
        { icon: "bell", text: "You get a notification at every step." },
      ]
    : [];

  return (
    <Screen
      padded={false}
      footer={
        o ? (
          <>
            <Button
              title="Track order"
              variant="dark"
              arrow
              onPress={() =>
                router.replace({
                  pathname: "/order/[id]",
                  params: { id: o.id },
                })
              }
            />
            <Button
              title="Back to home"
              variant="secondary"
              onPress={() => router.dismissAll()}
            />
          </>
        ) : undefined
      }
    >
      <View style={{ padding: 20, paddingTop: 40, paddingBottom: 32, gap: 18 }}>
        {q.error && !o ? (
          <ErrorNote message={q.error} onRetry={q.reload} />
        ) : !o ? (
          <Loading />
        ) : (
          <>
            <View style={{ alignItems: "center", gap: 10 }}>
              <Animated.View
                style={{
                  width: 148,
                  height: 148,
                  borderRadius: 74,
                  backgroundColor: confirmed ? color.okSoft : color.warnSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [
                    {
                      scale: confirmed
                        ? pop.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.6, 1],
                          })
                        : 1,
                    },
                  ],
                  opacity: confirmed ? pop : 1,
                }}
              >
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    backgroundColor: confirmed ? "#c4ead6" : "#f6e2aa",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 34,
                      backgroundColor: confirmed ? color.ok : color.warn,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={confirmed ? "check" : "clock"}
                      size={36}
                      tint="#fff"
                    />
                  </View>
                </View>
              </Animated.View>
              <Text
                style={{
                  fontFamily: font.display,
                  fontSize: 30,
                  color: color.navy,
                  letterSpacing: -0.7,
                  marginTop: 8,
                  textAlign: "center",
                }}
              >
                {confirmed ? "Payment received" : "Confirming payment…"}
              </Text>
              <Text
                style={{
                  fontFamily: font.body,
                  fontSize: 16,
                  lineHeight: 23,
                  color: color.muted,
                  textAlign: "center",
                  paddingHorizontal: 12,
                }}
              >
                {confirmed
                  ? `Thank you! Your order is confirmed. ${o.fulfilment === "delivery" ? "Delivery" : "Pickup"} on ${formatDate(o.delivery_date)}.`
                  : "This can take a moment. You do not need to pay again. We will update this screen as soon as Paystack confirms."}
              </Text>
            </View>

            <Card style={{ gap: 14 }}>
              <Receipt label="Order number" value={o.order_no} />
              <Receipt
                label="Paid with"
                value={
                  o.payment?.method === "office_cash"
                    ? "Cash at office"
                    : "Paystack (online)"
                }
              />
              <Receipt label="Bread" value={`${loaves} loaves`} />
              {o.savings_kobo > 0 ? (
                <Receipt
                  label="Savings added"
                  value={`+${formatNaira(o.savings_kobo)}`}
                  tint={color.ok}
                />
              ) : null}
              <Divider />
              <Receipt
                label="Amount paid"
                value={formatNaira(o.total_kobo)}
                strong
              />
            </Card>

            <Card style={{ gap: 14 }}>
              <H2>What happens next</H2>
              {next.map((n) => (
                <View
                  key={n.text}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: color.brandSoft,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={n.icon} size={17} tint={color.brand} />
                  </View>
                  <Body style={{ flex: 1 }}>{n.text}</Body>
                </View>
              ))}
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}
