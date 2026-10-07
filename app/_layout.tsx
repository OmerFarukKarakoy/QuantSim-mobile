import { useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTradeStore } from '../src/store/useTradeStore';
import { subscribeToMultiplePrices } from '../src/services/binance';

function TabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { positions, challenge, activeMode, setActiveMode, updateMarketPrice } = useTradeStore();

  // Tüm açık pozisyonların sembollerini topla ve arka planda canlı fiyatları dinle
  const activeSymbols = useMemo(() => {
    const freeSyms = (positions || []).map((p) => p.symbol);
    const challengeSyms = (challenge?.positions || []).map((p) => p.symbol);
    return Array.from(new Set([...freeSyms, ...challengeSyms]));
  }, [positions, challenge?.positions]);

  const activeSymbolsKey = activeSymbols.sort().join(',');

  useEffect(() => {
    if (activeSymbols.length === 0) return;
    const unsubscribe = subscribeToMultiplePrices(activeSymbols, (sym, price) => {
      updateMarketPrice(sym, price);
    });
    return () => {
      unsubscribe();
    };
  }, [activeSymbolsKey, updateMarketPrice]);

  const isChallenge = pathname === '/challenge' || activeMode === 'CHALLENGE';
  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  const tabHeight = Platform.OS === 'ios' ? 56 + bottomInset : (insets.bottom > 0 ? 60 + bottomInset : 66);

  const activePositionCount = isChallenge ? (challenge?.positions?.length || 0) : (positions?.length || 0);
  const primaryThemeColor = isChallenge ? '#3b82f6' : '#f0b90b';

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: primaryThemeColor,
          tabBarInactiveTintColor: '#848e9c',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarStyle: {
            backgroundColor: '#181a20',
            borderTopColor: isChallenge ? '#1e3a8a' : '#2b313a',
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: bottomInset,
            paddingTop: 8,
            elevation: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.35,
            shadowRadius: 5,
          },
        }}
      >
        {/* 1. İşlem (Serbest Mod veya Challenge Modu işlem ekranına yönlendirir) */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'İşlem',
            tabBarIcon: ({ color, focused }) => {
              const isTradeActive = focused || pathname === '/challenge';
              return (
                <Ionicons
                  name={isTradeActive ? 'trending-up' : 'trending-up-outline'}
                  size={22}
                  color={isTradeActive ? primaryThemeColor : color}
                />
              );
            },
            tabBarActiveTintColor: primaryThemeColor,
            tabBarInactiveTintColor: isChallenge ? primaryThemeColor : '#848e9c',
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setTimeout(() => {
                if (activeMode === 'CHALLENGE') {
                  router.replace('/challenge');
                } else {
                  router.replace('/');
                }
              }, 0);
            },
          }}
        />

        {/* 2. Pozisyonlar */}
        <Tabs.Screen
          name="positions"
          options={{
            title: 'Pozisyonlar',
            tabBarBadge: activePositionCount > 0 ? activePositionCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: isChallenge ? '#2563eb' : '#00c087',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 'bold',
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              lineHeight: 17,
            },
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'layers' : 'layers-outline'} size={22} color={color} />
            ),
          }}
        />

        {/* 3. Portföy */}
        <Tabs.Screen
          name="portfolio"
          options={{
            title: 'Portföy',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={color} />
            ),
          }}
        />

        {/* 4. Performans */}
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Performans',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={22} color={color} />
            ),
          }}
        />

        {/* 5. Geçmiş */}
        <Tabs.Screen
          name="history"
          options={{
            title: 'Geçmiş',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={color} />
            ),
          }}
        />

        {/* Challenge İşlem Ekranı (Tab çubuğunda ayrı sekme olarak yer almaz, sağ üst mod seçiciden veya İşlem sekmesinden açılır) */}
        <Tabs.Screen
          name="challenge"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TabsLayout />
    </SafeAreaProvider>
  );
}

