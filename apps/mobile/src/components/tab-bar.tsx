import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { color, font, shadow } from '@/theme';

type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type Feath = React.ComponentProps<typeof Feather>['name'];
const ICONS: Record<string, (c: string) => React.ReactNode> = {
  index: (c) => <Feather name={'home' as Feath} size={21} color={c} />,
  orders: (c) => <Feather name={'shopping-bag' as Feath} size={21} color={c} />,
  savings: (c) => <MaterialCommunityIcons name="piggy-bank-outline" size={23} color={c} />,
  profile: (c) => <Feather name={'user' as Feath} size={21} color={c} />,
};

/** Floating pill: the open tab expands into a blue pill with its name, the others show just an icon. */
export function FloatingTabBar({ state, descriptors, emitter, navigateToTab, icons }: BottomTabBarProps & { icons?: Record<string, Feath> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: color.cream, paddingHorizontal: 16, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 12) }}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 30, borderWidth: 1, borderColor: color.line, paddingVertical: 8, paddingHorizontal: 12, minHeight: 64 }, shadow]}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const { options } = descriptors[route.key]!;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const tint = focused ? '#fff' : color.muted;
          const onPress = () => {
            const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }} onPress={onPress}
              style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, minWidth: 56, paddingHorizontal: focused ? 18 : 0, borderRadius: 23, backgroundColor: focused ? color.side2 : 'transparent' }}>
                {icons?.[route.name] ? <Feather name={icons[route.name]!} size={21} color={tint} /> : ICONS[route.name]?.(tint)}
                {focused ? <Text style={{ fontFamily: font.bold, fontSize: 15, color: '#fff' }}>{label}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
