import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { fetchCurrentPrice, subscribeToMultiplePrices } from '../src/services/binance';
import { useTradeStore } from '../src/store/useTradeStore';
import { calculatePnL, calculateROE } from '../src/utils/math';

// Donut Grafik Sabitleri
const DONUT_R = 50;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_R; // ~314.16

const COLOR_PALETTE = [
  '#f7931a', // BTC Turuncu
  '#627eea', // ETH Mor-Mavi
  '#3b82f6', // Mavi
  '#f0b90b', // Binance Sarı
  '#ec4899', // Pembe
  '#8b5cf6', // Menekşe Moru
  '#06b6d4', // Camgöbeği (Cyan)
  '#10b981', // Zümrüt Yeşili
];

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    balance,
    availableBalance,
    positions,
    challenge,
    activeMode,
    syncBinanceBalance,
    isLoading,
    currency,
    usdTryRate,
    setCurrency,
    depositFreeBalance,
    updateMarketPrice,
  } = useTradeStore();

  const isChallenge = activeMode === 'CHALLENGE';
  const currentPositions = isChallenge ? (challenge?.positions || []) : (positions || []);
  const currentBalance = isChallenge ? (challenge?.balance ?? 100000) : balance;
  const usedMargin = currentPositions.reduce((sum, p) => sum + p.margin, 0);
  const currentAvailableBalance = isChallenge ? Math.max(0, (challenge?.balance ?? 100000) - usedMargin) : availableBalance;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customDepositAmount, setCustomDepositAmount] = useState<string>('');

  useEffect(() => {
    syncBinanceBalance();
  }, []);

  // Açık pozisyon sembolleri için canlı fiyat akışı
  const activeSymbolsKey = useMemo(() => {
    return Array.from(new Set(currentPositions.map((p) => p.symbol))).sort().join(',');
  }, [currentPositions]);

  useEffect(() => {
    if (!activeSymbolsKey) return;
    const symbols = activeSymbolsKey.split(',');

    // İlk REST sorgusu
    symbols.forEach((sym) => {
      fetchCurrentPrice(sym).then((price) => {
        if (price) updateMarketPrice(sym, price);
      });
    });

    // Canlı WebSocket fiyat akışı
    const unsubscribe = subscribeToMultiplePrices(symbols, (sym, price) => {
      updateMarketPrice(sym, price);
    });

    return () => {
      unsubscribe();
    };
  }, [activeSymbolsKey, updateMarketPrice]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncBinanceBalance();
    setIsRefreshing(false);
  };

  // Para Birimi ve Dönüşüm Hesaplamaları
  const displayCurrency = isChallenge ? (challenge?.currency || 'TRY') : currency;
  const currencySymbol = displayCurrency === 'TRY' ? '₺' : '$';
  const usdRate = usdTryRate > 0 ? usdTryRate : 34.85;
  const currencyRate = isChallenge ? 1 : (currency === 'TRY' ? usdRate : 1);
  const pnlRate = displayCurrency === 'TRY' ? usdRate : 1;

  const formatMoney = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleDeposit = (amount: number) => {
    if (!amount || amount <= 0) {
      Alert.alert('Geçersiz Miktar', 'Lütfen geçerli bir bakiye tutarı girin.');
      return;
    }
    const amountInUsd = currency === 'TRY' ? amount / usdRate : amount;
    depositFreeBalance(amountInUsd);
    setCustomDepositAmount('');
    Alert.alert(
      'Bakiye Eklendi! 💰',
      `Hesabınıza ${formatMoney(amount)} başarıyla yüklendi.\nYeni Kullanılabilir Bakiye: ${formatMoney((availableBalance + amountInUsd) * currencyRate)}`,
      [{ text: 'Tamam' }]
    );
  };

  const scrollToDeposit = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Açık pozisyonlardaki toplam marjin ve gerçekleşmemiş PnL
  const totalMarginUsed = currentPositions.reduce(
    (sum, pos) => sum + (isChallenge ? pos.margin : pos.margin * currencyRate),
    0
  );
  const totalUnrealizedPnL = currentPositions.reduce((sum, pos) => {
    return sum + calculatePnL(pos.entryPrice, pos.currentPrice, pos.amount, pos.side) * pnlRate;
  }, 0);

  const equity = (currentBalance * currencyRate) + totalUnrealizedPnL;
  const marginRatio = equity > 0 ? (totalMarginUsed / equity) * 100 : 0;

  // Portföy Dağılımı ve Pasta Grafiği Veri Hesaplamaları
  const cashVal = Math.max(0, currentAvailableBalance * currencyRate);
  const positionsNetValues = useMemo(() => {
    return currentPositions.map((pos) => {
      const pnl = calculatePnL(pos.entryPrice, pos.currentPrice, pos.amount, pos.side) * pnlRate;
      const posMargin = isChallenge ? pos.margin : pos.margin * currencyRate;
      const netVal = Math.max(0, posMargin + pnl);
      return { pos, pnl, netVal, margin: posMargin };
    });
  }, [currentPositions, isChallenge, currencyRate, pnlRate]);

  const totalAllocated = useMemo(() => {
    const sumPos = positionsNetValues.reduce((acc, curr) => acc + curr.netVal, 0);
    return Math.max(0, cashVal + sumPos);
  }, [cashVal, positionsNetValues]);

  const cashWeight = totalAllocated > 0 ? (cashVal / totalAllocated) * 100 : 100;

  // Donut Dilimleri
  const donutSlices = useMemo(() => {
    if (totalAllocated <= 0) {
      return [{ color: '#0ecb81', length: DONUT_CIRCUMFERENCE, offset: 0 }];
    }

    let currentOffset = 0;
    const slices: { color: string; length: number; offset: number }[] = [];

    // Nakit Dilimi
    if (cashWeight > 0) {
      const length = (cashWeight / 100) * DONUT_CIRCUMFERENCE;
      slices.push({
        color: '#0ecb81',
        length,
        offset: currentOffset,
      });
      currentOffset += length;
    }

    // Coin Pozisyon Dilimleri
    positionsNetValues.forEach((item, idx) => {
      const weight = (item.netVal / totalAllocated) * 100;
      if (weight > 0) {
        const length = (weight / 100) * DONUT_CIRCUMFERENCE;
        slices.push({
          color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
          length,
          offset: currentOffset,
        });
        currentOffset += length;
      }
    });

    return slices;
  }, [totalAllocated, cashWeight, positionsNetValues]);

  // Sağ Taraftaki Dağılım Göstergeleri (Legend)
  const breakdownItems = useMemo(() => {
    const items = [
      {
        id: 'cash',
        title: isChallenge ? `${challenge?.currency || 'TRY'} (Nakit)` : `${currency === 'TRY' ? 'TRY' : 'USDT'} (Nakit)`,
        sub: 'Kullanılabilir Nakit',
        color: '#0ecb81',
        percent: cashWeight,
        val: cashVal,
      },
      ...positionsNetValues.map((item, idx) => {
        const weight = totalAllocated > 0 ? (item.netVal / totalAllocated) * 100 : 0;
        return {
          id: item.pos.id,
          title: item.pos.symbol,
          sub: `${item.pos.side} ${item.pos.leverage}x`,
          color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
          percent: weight,
          val: item.netVal,
        };
      }),
    ];
    return items;
  }, [isChallenge, challenge?.currency, currency, cashWeight, cashVal, positionsNetValues, totalAllocated]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Üst Başlık & Yenile Butonu & Para Birimi Seçimi */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 2 }]}>
        <View>
          <Text style={styles.headerTitle}>Portföy & Cüzdan</Text>
          <Text style={styles.headerSub}>
            {isChallenge ? 'QuantSim Challenge Mod Bakiye (Katlama)' : 'QuantSim Serbest Mod Bakiye'}
          </Text>
        </View>

        <View style={styles.headerRightGroup}>
          {!isChallenge ? (
            <View style={styles.currencyToggleGroup}>
              <TouchableOpacity
                style={[styles.currencyPill, currency === 'TRY' && styles.currencyPillActive]}
                onPress={() => setCurrency('TRY')}
              >
                <Text style={[styles.currencyPillText, currency === 'TRY' && styles.currencyPillTextActive]}>₺</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.currencyPill, currency === 'USD' && styles.currencyPillActive]}
                onPress={() => setCurrency('USD')}
              >
                <Text style={[styles.currencyPillText, currency === 'USD' && styles.currencyPillTextActive]}>$</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.currencyPillActive, { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }]}>
              <Text style={styles.currencyPillTextActive}>
                {displayCurrency === 'TRY' ? '₺ TRY (Sabit)' : '$ USD (Sabit)'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            {isRefreshing || isLoading ? (
              <ActivityIndicator size="small" color={isChallenge ? '#60a5fa' : '#00c087'} />
            ) : (
              <Ionicons name="refresh" size={18} color={isChallenge ? '#60a5fa' : '#00c087'} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 1. BÖLÜM: 📊 Varlık & Coin Dağılımı (Pasta Grafiği & Sağ Dağılım)        */}
      {/* ========================================================================= */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartCardTitle}>📊 Varlık & Coin Dağılımı</Text>
          <Text style={styles.chartCardSub}>{currentPositions.length + 1} Varlık Kalemi</Text>
        </View>

        <View style={styles.chartContentRow}>
          {/* Sol Taraf: Donut (Pasta) Grafiği & Ortasında Toplam Varlık */}
          <View style={styles.donutWrapper}>
            <View style={{ transform: [{ rotate: '-90deg' }] }}>
              <Svg width={136} height={136} viewBox="0 0 136 136">
                {/* Arka plan halkası */}
                <Circle
                  cx="68"
                  cy="68"
                  r={DONUT_R}
                  stroke="#162030"
                  strokeWidth="15"
                  fill="transparent"
                />
                {/* Dağılım dilimleri */}
                {donutSlices.map((slice, i) => (
                  <Circle
                    key={i}
                    cx="68"
                    cy="68"
                    r={DONUT_R}
                    stroke={slice.color}
                    strokeWidth="15"
                    fill="transparent"
                    strokeDasharray={`${slice.length} ${DONUT_CIRCUMFERENCE}`}
                    strokeDashoffset={-slice.offset}
                    strokeLinecap="butt"
                  />
                ))}
              </Svg>
            </View>

            {/* Ortadaki Toplam Varlık Değeri */}
            <View style={styles.donutCenter}>
              <Text style={styles.donutCenterLabel}>TOPLAM VARLIK</Text>
              <Text style={styles.donutCenterValue} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(equity)}
              </Text>
              {totalUnrealizedPnL !== 0 && (
                <Text
                  style={[
                    styles.donutCenterPnL,
                    { color: totalUnrealizedPnL >= 0 ? '#00c087' : '#f43f5e' },
                  ]}
                  numberOfLines={1}
                >
                  {totalUnrealizedPnL >= 0 ? '+' : ''}{formatMoney(totalUnrealizedPnL)}
                </Text>
              )}
            </View>
          </View>

          {/* Sağ Taraf: Cash ve Coin Varlıkları Dağılım Listesi */}
          <View style={styles.breakdownListContainer}>
            <ScrollView
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={breakdownItems.length > 3}
              style={{ maxHeight: 155 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {breakdownItems.map((item) => (
                <View key={item.id} style={styles.breakdownItem}>
                  <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.breakdownTopRow}>
                      <Text style={styles.breakdownTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.breakdownPercent}>
                        %{item.percent.toFixed(1)}
                      </Text>
                    </View>
                    <View style={styles.breakdownBottomRow}>
                      <Text style={styles.breakdownSub}>{item.sub}</Text>
                      <Text style={styles.breakdownValue}>
                        {formatMoney(item.val)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 2. BÖLÜM: Toplam Sermaye (Est. Equity) Kutusu                              */}
      {/* ========================================================================= */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceCardHeader}>
          <Text style={styles.balanceLabel}>Toplam Sermaye (Est. Equity)</Text>
          <View style={styles.equityStatusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: totalUnrealizedPnL >= 0 ? '#00c087' : '#f43f5e' },
              ]}
            />
            <Text style={styles.equityStatusText}>
              {totalUnrealizedPnL >= 0 ? 'Karda' : 'Zararda'}
            </Text>
          </View>
        </View>

        <Text style={styles.balanceValue}>
          {formatMoney(equity)}
        </Text>

        {totalUnrealizedPnL !== 0 && (
          <View style={styles.unrealizedRow}>
            <Text style={styles.unrealizedLabel}>Canlı PnL:</Text>
            <Text
              style={[
                styles.unrealizedValue,
                { color: totalUnrealizedPnL >= 0 ? '#00c087' : '#f43f5e' },
              ]}
            >
              {totalUnrealizedPnL >= 0 ? '+' : ''}{formatMoney(totalUnrealizedPnL)}
            </Text>
          </View>
        )}

        <View style={styles.marginSection}>
          <View style={styles.marginRow}>
            <Text style={styles.marginText}>Teminat Kullanım Oranı</Text>
            <Text
              style={[
                styles.marginText,
                {
                  fontWeight: 'bold',
                  color: marginRatio > 80 ? '#f43f5e' : marginRatio > 50 ? '#f59e0b' : '#00c087',
                },
              ]}
            >
              %{marginRatio.toFixed(1)}
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(marginRatio, 100)}%`,
                  backgroundColor: marginRatio > 80 ? '#f43f5e' : marginRatio > 50 ? '#f59e0b' : '#00c087',
                },
              ]}
            />
          </View>

          <View style={styles.metricGrid}>
            <View>
              <Text style={styles.metricLabel}>Kullanılabilir Marjin</Text>
              <Text style={styles.metricValue}>{formatMoney(currentAvailableBalance * currencyRate)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metricLabel}>Bağlı Pozisyon Marjini</Text>
              <Text style={styles.metricValue}>{formatMoney(totalMarginUsed)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 3. BÖLÜM: Varlık Listesi & Portföy Dağılımı Tablosu                        */}
      {/* ========================================================================= */}
      <View style={styles.assetsHeaderSection}>
        <View>
          <Text style={styles.sectionMainTitle}>Varlık Listesi & Portföy Dağılımı</Text>
          <Text style={styles.sectionSubTitle}>{positions.length + 1} Varlık Kalemi</Text>
        </View>
        <Text style={styles.scrollTipText}>Yana Kaydırın 👉</Text>
      </View>

      <View style={styles.tableCard}>
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={true}
          nestedScrollEnabled={true}
        >
          <View style={styles.tableContent}>
            {/* Tablo Başlıkları */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.thCell, styles.colAsset]}>Varlık (Asset)</Text>
              <Text style={[styles.thCell, styles.colType]}>İşlem Türü / Durum</Text>
              <Text style={[styles.thCell, styles.colAmount]}>Miktar</Text>
              <Text style={[styles.thCell, styles.colMargin]}>Kilitli Marjin (Teminat)</Text>
              <Text style={[styles.thCell, styles.colNetValue]}>Anlık Değer / Net Değer</Text>
              <Text style={[styles.thCell, styles.colWeight]}>Ağırlık (%)</Text>
              <Text style={[styles.thCell, styles.colAction]}>Aksiyon</Text>
            </View>

            {/* 1. Satır: Serbest Nakit */}
            <View style={styles.tableRow}>
              {/* Varlık */}
              <View style={[styles.tdCell, styles.colAsset, styles.assetCellWrap]}>
                <View style={[styles.tableDot, { backgroundColor: '#0ecb81' }]} />
                <View>
                  <Text style={styles.tableNameMain}>{displayCurrency === 'TRY' ? 'TRY' : 'USDT'}</Text>
                  <Text style={styles.tableNameSub}>{displayCurrency === 'TRY' ? 'Türk Lirası (Nakit)' : 'Tether (Nakit)'}</Text>
                </View>
              </View>

              {/* İşlem Türü / Durum */}
              <View style={[styles.tdCell, styles.colType]}>
                <View style={styles.cashTypeBadge}>
                  <Text style={styles.cashTypeBadgeText}>Serbest Nakit</Text>
                </View>
              </View>

              {/* Miktar */}
              <View style={[styles.tdCell, styles.colAmount]}>
                <Text style={styles.tableAmountMain}>
                  {(currentAvailableBalance * currencyRate).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={styles.tableAmountSub}>{displayCurrency === 'TRY' ? 'TRY' : 'USDT'}</Text>
              </View>

              {/* Kilitli Marjin */}
              <View style={[styles.tdCell, styles.colMargin]}>
                <Text style={styles.tableDashText}>---</Text>
                <Text style={styles.tableAmountSub}>(Serbest)</Text>
              </View>

              {/* Anlık Değer / Net Değer */}
              <View style={[styles.tdCell, styles.colNetValue]}>
                <Text style={styles.tableValueMain}>{formatMoney(currentAvailableBalance * currencyRate)}</Text>
                <Text style={styles.tableValueSub}>Hazır Bakiye</Text>
              </View>

              {/* Ağırlık (%) */}
              <View style={[styles.tdCell, styles.colWeight]}>
                <Text style={styles.tableWeightText}>%{cashWeight.toFixed(1)}</Text>
                <View style={styles.weightMiniBarBg}>
                  <View
                    style={[
                      styles.weightMiniBarFill,
                      { width: `${Math.min(cashWeight, 100)}%`, backgroundColor: '#0ecb81' },
                    ]}
                  />
                </View>
              </View>

              {/* Aksiyon */}
              <View style={[styles.tdCell, styles.colAction]}>
                {!isChallenge ? (
                  <TouchableOpacity
                    style={styles.depositActionBtn}
                    onPress={scrollToDeposit}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={13} color="#f0b90b" />
                    <Text style={styles.depositActionBtnText}>Para Ekle</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.tableDashText}>---</Text>
                )}
              </View>
            </View>

            {/* 2+. Satırlar: Açık Pozisyonlar (Coin Varlıkları) */}
            {positionsNetValues.map((item, idx) => {
              const { pos, pnl, netVal, margin } = item;
              const weight = totalAllocated > 0 ? (netVal / totalAllocated) * 100 : 0;
              const roe = calculateROE(pnl, margin);
              const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
              const isLong = pos.side === 'LONG';

              return (
                <View key={pos.id} style={styles.tableRow}>
                  {/* Varlık */}
                  <View style={[styles.tdCell, styles.colAsset, styles.assetCellWrap]}>
                    <View style={[styles.tableDot, { backgroundColor: color }]} />
                    <View>
                      <Text style={styles.tableNameMain}>{pos.symbol}</Text>
                      <Text style={styles.tableNameSub}>Vadeli İşlem</Text>
                    </View>
                  </View>

                  {/* İşlem Türü / Durum */}
                  <View style={[styles.tdCell, styles.colType]}>
                    <View
                      style={[
                        styles.posTypeBadge,
                        { backgroundColor: isLong ? 'rgba(0, 192, 135, 0.15)' : 'rgba(244, 63, 94, 0.15)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.posTypeBadgeText,
                          { color: isLong ? '#00c087' : '#f43f5e' },
                        ]}
                      >
                        {pos.side} {pos.leverage}x
                      </Text>
                    </View>
                  </View>

                  {/* Miktar */}
                  <View style={[styles.tdCell, styles.colAmount]}>
                    <Text style={styles.tableAmountMain}>{pos.amount.toFixed(4)}</Text>
                    <Text style={styles.tableAmountSub}>{pos.symbol.replace('USDT', '')}</Text>
                  </View>

                  {/* Kilitli Marjin */}
                  <View style={[styles.tdCell, styles.colMargin]}>
                    <Text style={styles.tableAmountMain}>{formatMoney(margin)}</Text>
                    <Text style={styles.tableAmountSub}>Kilitli</Text>
                  </View>

                  {/* Anlık Değer / Net Değer */}
                  <View style={[styles.tdCell, styles.colNetValue]}>
                    <Text style={styles.tableValueMain}>{formatMoney(netVal)}</Text>
                    <Text
                      style={[
                        styles.tablePnLSub,
                        { color: pnl >= 0 ? '#00c087' : '#f43f5e' },
                      ]}
                    >
                      {pnl >= 0 ? '+' : ''}{formatMoney(pnl)} ({pnl >= 0 ? '+' : ''}{roe.toFixed(1)}%)
                    </Text>
                  </View>

                  {/* Ağırlık (%) */}
                  <View style={[styles.tdCell, styles.colWeight]}>
                    <Text style={styles.tableWeightText}>%{weight.toFixed(1)}</Text>
                    <View style={styles.weightMiniBarBg}>
                      <View
                        style={[
                          styles.weightMiniBarFill,
                          { width: `${Math.min(weight, 100)}%`, backgroundColor: color },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Aksiyon */}
                  <View style={[styles.tdCell, styles.colAction]}>
                    <TouchableOpacity
                      style={styles.tradeActionBtn}
                      onPress={() => router.push(isChallenge ? '/challenge' : '/positions')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="arrow-forward-circle-outline" size={13} color="#3b82f6" />
                      <Text style={styles.tradeActionBtnText}>Pozisyona Git</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ========================================================================= */}
      {/* 4. BÖLÜM: Bakiye Ekleme veya Challenge Modu Bilgilendirmesi               */}
      {/* ========================================================================= */}
      {isChallenge ? (
        <View style={[styles.depositBoxCard, { borderColor: '#1e3a8a' }]}>
          <View style={styles.depositBoxHeader}>
            <View style={[styles.depositBoxIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
              <Ionicons name="trophy-outline" size={20} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.depositBoxTitle}>Trade Challenge Katlama Hedefi Durumu</Text>
              <Text style={styles.depositBoxSub}>
                Başlangıç bakiyenizi 2 katına çıkarma (%100 kâr) hedefi
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 12, backgroundColor: '#0c121d', borderRadius: 12, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>Başlangıç Bakiyesi</Text>
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>
                {formatMoney(challenge?.initialBalance || 1000)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>Katlama Hedefi (2x)</Text>
              <Text style={{ color: '#00c087', fontSize: 14, fontWeight: '700' }}>
                {formatMoney((challenge?.initialBalance || 1000) * 2)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>Mevcut Toplam Varlık</Text>
              <Text style={{ color: equity >= (challenge?.initialBalance || 1000) ? '#00c087' : '#f43f5e', fontSize: 14, fontWeight: '700' }}>
                {formatMoney(equity)}
              </Text>
            </View>

            {/* İlerleme Çubuğu */}
            <View style={{ marginTop: 4 }}>
              <View style={{ height: 8, backgroundColor: '#1e293b', borderRadius: 4, overflow: 'hidden' }}>
                <View
                  style={{
                    height: '100%',
                    backgroundColor: '#3b82f6',
                    width: `${Math.min(Math.max(((equity - (challenge?.initialBalance || 1000)) / (challenge?.initialBalance || 1000)) * 100, 0), 100)}%`,
                  }}
                />
              </View>
              <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4, textAlign: 'right' }}>
                Hedefe İlerleme: %{Math.max(0, (((equity - (challenge?.initialBalance || 1000)) / (challenge?.initialBalance || 1000)) * 100)).toFixed(1)}
              </Text>
            </View>

            <View style={{ marginTop: 6, padding: 10, backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: 8 }}>
              <Text style={{ color: '#93c5fd', fontSize: 11, lineHeight: 16 }}>
                ℹ️ Trade Challenge modunda dışarıdan bakiye ekleme ve para birimi değişimi yapılamaz. Tüm işlemler başta seçilen para birimi ({displayCurrency}) ile devam eder.
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.depositBoxCard}>
          <View style={styles.depositBoxHeader}>
            <View style={styles.depositBoxIconWrap}>
              <Ionicons name="cash-outline" size={20} color="#f0b90b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.depositBoxTitle}>Serbest Mod Bakiyeye Para Ekle (Bakiye Artır)</Text>
              <Text style={styles.depositBoxSub}>
                Pratik bakiyenizi artırmak için eklenecek miktarı seçin veya yazın:
              </Text>
            </View>
          </View>

          {/* Hızlı Miktar Önerileri */}
          <View style={styles.depositPresetRow}>
            {(currency === 'TRY'
              ? [1000, 5000, 10000, 50000, 100000]
              : [100, 500, 1000, 5000, 10000]
            ).map((val) => (
              <TouchableOpacity
                key={val}
                style={styles.depositPresetBtn}
                onPress={() => handleDeposit(val)}
                activeOpacity={0.8}
              >
                <Text style={styles.depositPresetText}>
                  +{currencySymbol}{val.toLocaleString('tr-TR')} Ekle
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Özel Miktar Girişi ve Buton */}
          <View style={styles.depositCustomRow}>
            <View style={styles.depositInputWrap}>
              <Text style={styles.depositInputPrefix}>{currencySymbol}</Text>
              <TextInput
                style={styles.depositCustomInput}
                keyboardType="numeric"
                value={customDepositAmount}
                onChangeText={setCustomDepositAmount}
                placeholder="Eklenecek Özel Bakiye"
                placeholderTextColor="#5e6673"
              />
            </View>

            <TouchableOpacity
              style={styles.depositSubmitBtn}
              onPress={() => handleDeposit(parseFloat(customDepositAmount || '0'))}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={16} color="#0b0e11" />
              <Text style={styles.depositSubmitBtnText}>Bakiyeye Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0e16',
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#111823',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  currencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currencyPillActive: {
    backgroundColor: '#00c087',
  },
  currencyPillText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currencyPillTextActive: {
    color: '#070a0f',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#111823',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },

  // =========================================================================
  // 1. Bölüm: Varlık & Coin Dağılımı (Pasta Grafiği) Stilleri
  // =========================================================================
  chartCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#0d131d',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1b2434',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
    paddingBottom: 10,
  },
  chartCardTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  chartCardSub: {
    color: '#64748b',
    fontSize: 12,
  },
  chartContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  donutWrapper: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 86,
  },
  donutCenterLabel: {
    color: '#64748b',
    fontSize: 8.5,
    fontWeight: 'bold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  donutCenterValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center',
  },
  donutCenterPnL: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 1,
  },
  breakdownListContainer: {
    flex: 1,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#111823',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  breakdownDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  breakdownTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
  },
  breakdownPercent: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  breakdownBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 1,
  },
  breakdownSub: {
    color: '#64748b',
    fontSize: 10,
  },
  breakdownValue: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },

  // =========================================================================
  // 2. Bölüm: Toplam Sermaye (Est. Equity) Kartı Stilleri
  // =========================================================================
  balanceCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#0d131d',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1b2434',
  },
  balanceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#64748b',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  equityStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111823',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  equityStatusText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 6,
    marginBottom: 6,
  },
  unrealizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  unrealizedLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  unrealizedValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  marginSection: {
    borderTopWidth: 1,
    borderTopColor: '#162030',
    paddingTop: 12,
  },
  marginRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  marginText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#162030',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
  },
  metricGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 2,
  },
  metricValue: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // =========================================================================
  // 3. Bölüm: Varlık Listesi & Portföy Dağılımı Tablosu Stilleri
  // =========================================================================
  assetsHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  sectionMainTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionSubTitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  scrollTipText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  tableCard: {
    marginHorizontal: 16,
    backgroundColor: '#0d131d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1b2434',
    overflow: 'hidden',
  },
  tableContent: {
    minWidth: 840,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#111823',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  thCell: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tdCell: {
    justifyContent: 'center',
  },

  // Sütun Genişlikleri
  colAsset: {
    width: 135,
  },
  colType: {
    width: 125,
  },
  colAmount: {
    width: 115,
  },
  colMargin: {
    width: 130,
  },
  colNetValue: {
    width: 145,
  },
  colWeight: {
    width: 95,
  },
  colAction: {
    width: 95,
  },

  assetCellWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tableNameMain: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tableNameSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  cashTypeBadge: {
    backgroundColor: 'rgba(0, 192, 135, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0, 192, 135, 0.25)',
  },
  cashTypeBadgeText: {
    color: '#00c087',
    fontSize: 11,
    fontWeight: '600',
  },
  posTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  posTypeBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  tableAmountMain: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tableAmountSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  tableDashText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tableValueMain: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  tableValueSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  tablePnLSub: {
    fontSize: 10.5,
    fontWeight: 'bold',
    marginTop: 1,
  },
  tableWeightText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  weightMiniBarBg: {
    height: 4,
    backgroundColor: '#162030',
    borderRadius: 2,
    width: 60,
    overflow: 'hidden',
  },
  weightMiniBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  depositActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(240, 185, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.3)',
    alignSelf: 'flex-start',
  },
  depositActionBtnText: {
    color: '#f0b90b',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  tradeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    alignSelf: 'flex-start',
  },
  tradeActionBtnText: {
    color: '#3b82f6',
    fontSize: 10.5,
    fontWeight: 'bold',
  },

  // =========================================================================
  // 4. Bölüm (En Alt): Serbest Mod Bakiyeye Para Ekle Stilleri
  // =========================================================================
  depositBoxCard: {
    backgroundColor: '#0d131d',
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.25)',
  },
  depositBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  depositBoxIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositBoxTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  depositBoxSub: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 2,
  },
  depositPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  depositPresetBtn: {
    backgroundColor: '#111823',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  depositPresetText: {
    color: '#f0b90b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  depositCustomRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  depositInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111823',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 10,
  },
  depositInputPrefix: {
    color: '#f0b90b',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 6,
  },
  depositCustomInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 9,
    fontWeight: '600',
  },
  depositSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0b90b',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 8,
  },
  depositSubmitBtnText: {
    color: '#070a0f',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
