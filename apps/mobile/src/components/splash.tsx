import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { color, font } from "@/theme";

/**
 * The start-up screen. The native splash (navy + the "MN." mark, set in app.json) stays up until this has drawn its first frame,
 * so there is no flash between the two. The mark is placed exactly where the native image puts it, then the full wordmark rises in beneath it.
 * It leaves (fade + slight zoom) once the app is ready and it has been on screen long enough to read as intentional.
 */

// Must match app.json: expo-splash-screen imageWidth, and the mark's share of the PNG width (scripts/make-brand-assets.py).
const NATIVE_IMAGE_WIDTH = 360;
const MARK_SHARE = 0.36;
const MARK_FONT = (NATIVE_IMAGE_WIDTH * MARK_SHARE) / 1.903; // Figtree ExtraBold "MN." is 1.903em wide
const MIN_VISIBLE_MS = 1500;

export function AnimatedSplash({
  ready,
  children,
}: {
  ready: boolean;
  children: React.ReactNode;
}) {
  const [gone, setGone] = useState(false);
  const [shown, setShown] = useState(false); // first frame drawn
  const started = useRef(0);
  const rise = useRef(new Animated.Value(0)).current; // wordmark + caption
  const dot = useRef(new Animated.Value(0)).current; // orange full-stop pulse
  const out = useRef(new Animated.Value(0)).current; // exit

  const onLayout = () => {
    if (shown) return;
    setShown(true);
    started.current = Date.now();
    void SplashScreen.hideAsync();
    Animated.sequence([
      Animated.delay(250),
      Animated.timing(rise, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(dot, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  useEffect(() => {
    if (!shown || !ready || gone) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - started.current));
    const t = setTimeout(() => {
      Animated.timing(out, {
        toValue: 1,
        duration: 380,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setGone(true));
    }, wait);
    return () => clearTimeout(t);
  }, [shown, ready, gone, out]);

  return (
    <View style={styles.root}>
      {children}
      {!gone && (
        <Animated.View
          pointerEvents={shown && ready ? "none" : "auto"}
          onLayout={onLayout}
          style={[
            styles.splash,
            {
              opacity: out.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  scale: out.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.06],
                  }),
                },
              ],
            },
          ]}
        >
          <StatusBar style="light" />
          {/* the mark: centred exactly like the native image */}
          {/* <View style={styles.markWrap}>
            <View style={styles.markRow}>
              <Text style={styles.mark} allowFontScaling={false}>
                MN
              </Text>
              <Animated.Text
                allowFontScaling={false}
                style={[
                  styles.mark,
                  {
                    color: color.orange,
                    opacity: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.35],
                    }),
                  },
                ]}
              >
                .
              </Animated.Text>
            </View>
          </View> */}
          {/* wordmark + caption sit below the mark */}
          <Animated.View
            style={[
              styles.below,
              {
                opacity: rise,
                transform: [
                  {
                    translateY: rise.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.word} allowFontScaling={false}>
              Mr Nibbles<Text style={{ color: color.orange }}>.</Text>
            </Text>
            <Text style={styles.caption} allowFontScaling={false}>
              Fresh bread, delivered.
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.side,
    alignItems: "center",
    justifyContent: "center",
  },
  markWrap: { alignItems: "center", justifyContent: "center" },
  markRow: { flexDirection: "row", alignItems: "center" },
  mark: {
    fontFamily: font.display,
    fontSize: MARK_FONT,
    lineHeight: MARK_FONT * 1.2,
    color: "#fff",
    includeFontPadding: false,
  },
  below: {
    position: "absolute",
    // top: "50%",
    // marginTop: MARK_FONT * 0.6 + 36,
    alignItems: "center",
  },
  word: {
    fontFamily: font.display,
    fontSize: 22,
    letterSpacing: -0.3,
    color: "#fff",
  },
  caption: {
    marginTop: 6,
    fontFamily: font.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.4,
    color: "rgba(255,255,255,0.55)",
  },
});
