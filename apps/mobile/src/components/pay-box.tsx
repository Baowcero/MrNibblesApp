import { ActivityIndicator, Text, View } from "react-native";
import { formatNaira } from "@/lib/format";
import { Body, Button, Divider, Icon } from "@/components/ui";
import { color, font, tnum } from "@/theme";

/** The "payment needed" panel on an unpaid order: what is owed, how to pay, and how to check a payment that has already been made. */
export function PayBox({
  orderNo,
  totalKobo,
  method,
  busy,
  checking,
  onPay,
  onCheck,
  onSwitch,
}: {
  orderNo: string;
  totalKobo: number;
  method: "paystack" | "office_cash";
  busy: string | null;
  checking: boolean;
  onPay: () => void;
  onCheck: () => void;
  onSwitch: () => void;
}) {
  const online = method === "paystack";
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: color.line,
        padding: 18,
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {/* <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: color.warnSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={online ? "credit-card" : "briefcase"}
            size={20}
            tint={color.warn}
          />
        </View> */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: font.bold,
              fontSize: 17,
              color: color.navy,
              marginBottom: 2,
            }}
          >
            {online ? "Complete your payment" : "Pay cash at the office"}
          </Text>
          <Text
            style={{
              fontFamily: font.body,
              fontSize: 13.5,
              color: color.muted,
            }}
          >
            {orderNo} is not confirmed until it is paid.
          </Text>
        </View>
      </View>

      {/* <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{ fontFamily: font.semi, fontSize: 14, color: color.muted }}
        >
          Amount due
        </Text>
        <Text
          style={[
            {
              fontFamily: font.display,
              fontSize: 30,
              color: color.navy,
              letterSpacing: -0.8,
            },
            tnum,
          ]}
        >
          {formatNaira(totalKobo)}
        </Text>
      </View> */}

      {checking ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: color.brandSoft,
            borderRadius: 14,
            padding: 12,
          }}
        >
          <ActivityIndicator color={color.brand} />
          <Text
            style={{
              flex: 1,
              fontFamily: font.semi,
              fontSize: 14,
              color: color.brandDark,
            }}
          >
            Checking your payment status. This takes a few seconds.
          </Text>
        </View>
      ) : null}

      {online ? (
        <>
          <Button
            title={`Pay ${formatNaira(totalKobo)}`}
            variant="accent"
            onPress={onPay}
            busy={busy === "pay"}
            disabled={busy !== null && busy !== "pay"}
          />
          <Divider />
          <View style={{ gap: 8 }}>
            {/* <Text
              style={{
                fontFamily: font.bold,
                fontSize: 14.5,
                color: color.navy,
              }}
            >
              Already paid?
            </Text>
            <Body muted style={{ fontSize: 13.5, lineHeight: 19 }}>
              We confirm with Paystack directly, so this only works once your
              payment has gone through. It usually takes a few seconds.
            </Body> */}
            <Button
              title="I have paid, check now"
              variant="secondary"
              icon="refresh-cw"
              onPress={onCheck}
              busy={busy === "check"}
              disabled={busy !== null && busy !== "check"}
            />
          </View>
          <Button
            title="Pay cash at the office instead"
            variant="ghost"
            onPress={onSwitch}
            busy={busy === "switch"}
          />
        </>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            {[
              "Bring the exact amount to the bakery office.",
              "Our team records it and marks your order paid.",
              "You get a notification, then your order goes ahead.",
            ].map((s, i) => (
              <View
                key={s}
                style={{
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: color.cream2,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: font.bold,
                      fontSize: 12,
                      color: color.navy,
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: font.body,
                    fontSize: 14.5,
                    lineHeight: 20,
                    color: color.navy,
                  }}
                >
                  {s}
                </Text>
              </View>
            ))}
          </View>
          <Button
            title="Pay online instead"
            variant="secondary"
            icon="credit-card"
            onPress={onSwitch}
            busy={busy === "switch"}
          />
        </>
      )}
    </View>
  );
}
