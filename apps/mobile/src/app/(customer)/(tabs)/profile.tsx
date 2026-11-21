import { Alert, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSession } from "@/lib/session";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  H1,
  Icon,
  Screen,
  SectionHead,
  type IconName,
} from "@/components/ui";
import { color, font } from "@/theme";

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  active: { label: "Active account", tone: "ok" },
  pending_approval: { label: "Awaiting approval", tone: "warn" },
  rejected: { label: "Not approved", tone: "bad" },
  suspended: { label: "Paused", tone: "bad" },
};

/** One line of the account list: icon chip, small label, value. Tappable rows show a chevron, locked rows a lock. */
function InfoRow({
  icon,
  label,
  value,
  onPress,
  locked,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress?: () => void;
  locked?: boolean;
}) {
  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 4,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: color.cream2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={17} tint={color.navy} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: font.semi, fontSize: 12.5, color: color.muted }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: font.bold,
            fontSize: 15.5,
            color: value ? color.navy : "#9aa3b5",
          }}
          numberOfLines={1}
        >
          {value || "Not added"}
        </Text>
      </View>
      {locked ? (
        <Icon name="lock" size={15} tint="#9aa3b5" />
      ) : onPress ? (
        <Icon name="chevron-right" size={18} tint={color.muted} />
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value || "not added"}`}
      onPress={onPress}
    >
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

export default function Profile() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const st = STATUS[user?.customer?.status ?? ""];
  const business = user?.customer?.business_name ?? user?.full_name;
  const locations = user?.locations ?? [];

  return (
    <Screen>
      <H1>Profile</H1>

      <View
        style={{
          backgroundColor: color.side,
          borderRadius: 24,
          padding: 22,
          overflow: "hidden",
          gap: 14,
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
            backgroundColor: color.orange,
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            style={{
              borderRadius: 34,
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.25)",
            }}
          >
            <Avatar name={business} size={60} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: font.display,
                fontSize: 22,
                color: "#fff",
                letterSpacing: -0.4,
              }}
              numberOfLines={1}
            >
              {business}
            </Text>
            <Text
              style={{ fontFamily: font.body, fontSize: 14, color: "#c9d5f2" }}
              numberOfLines={1}
            >
              {user?.full_name}
            </Text>
          </View>
        </View>
        {st ? <Badge text={st.label} tone={st.tone} /> : null}
      </View>

      <Card style={{ gap: 12 }}>
        <SectionHead
          title="Your details"
          action="Edit"
          onAction={() => router.push("/edit-profile")}
        />
        <InfoRow icon="user" label="Full name" value={user?.full_name ?? ""} />
        <Divider />
        <InfoRow
          icon="phone"
          label="Phone number"
          value={user?.phone ?? ""}
          locked
        />
        <Divider />
        <InfoRow
          icon="mail"
          label="Email for receipts"
          value={user?.email ?? ""}
        />
        <Divider />
        <InfoRow
          icon="briefcase"
          label="Business"
          value={user?.customer?.business_name ?? ""}
          locked
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionHead
          title="Delivery addresses"
          action="Add"
          onAction={() => router.push("/address")}
        />
        {locations.length === 0 ? (
          <Text
            style={{
              fontFamily: font.body,
              fontSize: 14.5,
              color: color.muted,
            }}
          >
            No address saved yet. Add one to order for delivery.
          </Text>
        ) : (
          locations.map((l, i) => (
            <View key={l.id} style={{ gap: 12 }}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit address ${l.label}`}
                onPress={() =>
                  router.push({ pathname: "/address", params: { id: l.id } })
                }
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    backgroundColor: color.brandSoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="map-pin" size={17} tint={color.brand} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: font.bold,
                        fontSize: 15.5,
                        color: color.navy,
                      }}
                    >
                      {l.label}
                    </Text>
                    {l.is_default ? (
                      <Badge text="Default" tone="brand" />
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontFamily: font.body,
                      fontSize: 14,
                      color: color.muted,
                    }}
                    numberOfLines={2}
                  >
                    {l.address}, {l.area.name}
                  </Text>
                </View>
                <Icon name="chevron-right" size={18} tint={color.muted} />
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionHead title="Security" />
        <InfoRow
          icon="lock"
          label="Password"
          value="Change your password"
          onPress={() => router.push("/change-password")}
        />
      </Card>

      <View style={{ marginTop: 4 }}>
        <Button
          title="Log out"
          variant="secondary"
          icon="log-out"
          onPress={() =>
            Alert.alert(
              "Log out?",
              "You will need your password to log in again.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Log out",
                  style: "destructive",
                  onPress: () => void signOut(),
                },
              ],
            )
          }
        />
      </View>
    </Screen>
  );
}
