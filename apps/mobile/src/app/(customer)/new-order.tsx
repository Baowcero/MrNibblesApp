import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/session";
import { useQuery } from "@/lib/use-query";
import { formatNaira } from "@/lib/format";
import {
  Body,
  Button,
  Card,
  Choice,
  ErrorNote,
  Icon,
  Loading,
  Row,
  Screen,
  TopBar,
} from "@/components/ui";
import { color, font, tnum } from "@/theme";

interface Product {
  id: string;
  code: string;
  name: string;
  unit_price_kobo: number;
}
type Fulfilment = "delivery" | "pickup";
const QUICK = [10, 20, 50, 100];

function Segmented({
  value,
  onChange,
}: {
  value: Fulfilment;
  onChange: (v: Fulfilment) => void;
}) {
  const opts: { key: Fulfilment; label: string }[] = [
    { key: "delivery", label: "Delivery" },
    { key: "pickup", label: "Office pickup" },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: color.cream2,
        borderRadius: 18,
        padding: 4,
      }}
    >
      {opts.map((o) => {
        const on = value === o.key;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? "#fff" : "transparent",
              borderWidth: on ? 1 : 0,
              borderColor: color.line,
            }}
          >
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 15,
                color: on ? color.navy : color.muted,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Step 1 of 3: choose the bread. Nothing is placed or charged here; "Review order" moves on to the review and pay screen. */
export default function NewOrder() {
  const router = useRouter();
  const { user } = useSession();
  const products = useQuery<{ data: Product[] }>("products");
  const locations = useMemo(() => user?.locations ?? [], [user]);

  const [qty, setQty] = useState<Record<string, number>>({});
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [locationId, setLocationId] = useState("");
  const [pick, setPick] = useState(false);

  useEffect(() => {
    if (!locationId && locations.length)
      setLocationId((locations.find((l) => l.is_default) ?? locations[0]!).id);
  }, [locations, locationId]);

  const set = (id: string, n: number) =>
    setQty((q) => ({
      ...q,
      [id]: Math.max(0, Math.min(100000, Math.round(n) || 0)),
    }));
  const items = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, n]) => n > 0)
        .map(([product_id, quantity]) => ({ product_id, quantity })),
    [qty],
  );
  const loaves = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = (products.data?.data ?? []).reduce(
    (n, p) => n + p.unit_price_kobo * (qty[p.id] ?? 0),
    0,
  );
  const chosen = locations.find((l) => l.id === locationId);
  const canReview = loaves > 0 && (fulfilment === "pickup" || !!locationId);

  return (
    <Screen
      footer={
        <>
          <Row>
            <Text
              style={{
                fontFamily: font.semi,
                fontSize: 14.5,
                color: color.muted,
              }}
            >
              {loaves} {loaves === 1 ? "loaf" : "loaves"}
            </Text>
            <Text
              style={[
                { fontFamily: font.display, fontSize: 22, color: color.navy },
                tnum,
              ]}
            >
              {formatNaira(subtotal)}
            </Text>
          </Row>
          <Button
            title="Review order"
            variant="accent"
            arrow
            disabled={!canReview}
            onPress={() =>
              router.push({
                pathname: "/review",
                params: {
                  items: JSON.stringify(items),
                  fulfilment,
                  location_id: fulfilment === "delivery" ? locationId : "",
                },
              })
            }
          />
        </>
      }
    >
      <TopBar title="New order" />
      <Segmented value={fulfilment} onChange={setFulfilment} />

      {fulfilment === "delivery" ? (
        <View style={{ gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            disabled={locations.length < 2}
            onPress={() => setPick((p) => !p)}
          >
            <Card
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
              }}
            >
              <Icon name="map-pin" size={20} tint={color.brand} />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: font.semi,
                    fontSize: 13,
                    color: color.muted,
                  }}
                >
                  Deliver to
                </Text>
                <Text
                  style={{
                    fontFamily: font.bold,
                    fontSize: 16.5,
                    color: color.navy,
                  }}
                >
                  {chosen
                    ? `${chosen.label}, ${chosen.area.name}`
                    : "No delivery address yet"}
                </Text>
              </View>
              {locations.length > 1 ? (
                <Icon
                  name={pick ? "chevron-up" : "chevron-down"}
                  size={20}
                  tint={color.muted}
                />
              ) : null}
            </Card>
          </Pressable>
          {pick &&
            locations.map((l) => (
              <Choice
                key={l.id}
                icon="map-pin"
                label={l.label}
                sub={`${l.address}, ${l.area.name}`}
                on={locationId === l.id}
                onPress={() => {
                  setLocationId(l.id);
                  setPick(false);
                }}
              />
            ))}
        </View>
      ) : (
        <Card
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 14,
          }}
        >
          <Icon name="shopping-bag" size={20} tint={color.brand} />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: font.semi,
                fontSize: 13,
                color: color.muted,
              }}
            >
              Pick up from
            </Text>
            <Text
              style={{
                fontFamily: font.bold,
                fontSize: 16.5,
                color: color.navy,
              }}
            >
              The bakery, Ogbomoso
            </Text>
          </View>
        </Card>
      )}

      {products.error ? (
        <ErrorNote message={products.error} onRetry={products.reload} />
      ) : !products.data ? (
        <Loading />
      ) : (
        products.data.data.map((p) => {
          const n = qty[p.id] ?? 0;
          return (
            <Card key={p.id} style={{ gap: 14 }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: font.display,
                      fontSize: 20,
                      color: color.navy,
                      letterSpacing: -0.3,
                    }}
                  >
                    {p.name}
                  </Text>
                  <Body muted>{formatNaira(p.unit_price_kobo)} each</Body>
                </View>
                {n > 0 ? (
                  <Text
                    style={[
                      {
                        fontFamily: font.bold,
                        fontSize: 15,
                        color: color.brand,
                      },
                      tnum,
                    ]}
                  >
                    {formatNaira(p.unit_price_kobo * n)}
                  </Text>
                ) : null}
              </Row>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove one ${p.name}`}
                  onPress={() => set(p.id, n - 1)}
                  style={[stepper, { backgroundColor: color.cream2 }]}
                >
                  <Icon name="minus" size={20} />
                </Pressable>
                <View
                  style={{
                    flex: 1,
                    height: 52,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: color.line,
                    backgroundColor: "#fff",
                    justifyContent: "center",
                  }}
                >
                  <TextInput
                    accessibilityLabel={`${p.name} quantity`}
                    value={n === 0 ? "" : String(n)}
                    placeholder="0"
                    placeholderTextColor="#b6bccb"
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(v) =>
                      set(p.id, Number(v.replace(/\D/g, "")))
                    }
                    style={[
                      {
                        textAlign: "center",
                        fontFamily: font.display,
                        fontSize: 26,
                        color: color.navy,
                      },
                      tnum,
                    ]}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add one ${p.name}`}
                  onPress={() => set(p.id, n + 1)}
                  style={[stepper, { backgroundColor: color.side2 }]}
                >
                  <Icon name="plus" size={20} tint="#fff" />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {QUICK.map((k) => (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${k} ${p.name}`}
                    onPress={() => set(p.id, n + k)}
                    style={{
                      flex: 1,
                      height: 42,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: color.line,
                      backgroundColor: color.cream,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: font.bold,
                        fontSize: 14.5,
                        color: color.navy,
                      }}
                    >
                      +{k}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const stepper = {
  width: 52,
  height: 52,
  borderRadius: 26,
  alignItems: "center",
  justifyContent: "center",
} as const;
