import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { TradeHistoryItem, useTradeStore } from '../src/store/useTradeStore';
import { calculatePnL } from '../src/utils/math';

// Zaman Dilimi Veri Konfigürasyonu
const TIMEFRAME_CONFIG = {
  ALL: {
    label: 'Tüm Zamanlar',
    xLabels: ['Başlangıç', 'İşlemler', 'Bugün'],
  },
  '30D': {
    label: '30 Gün',
    xLabels: ['30G Önce', '15G Önce', 'Bugün'],
  },
  '7D': {
    label: '7 Gün',
    xLabels: ['7G Önce', '4G Önce', 'Bugün'],
  },
  '24H': {
    label: '24 Saat',
    xLabels: ['24S Önce', '12S Önce', 'Şimdi'],
  },
};

type TimeframeKey = keyof typeof TIMEFRAME_CONFIG;

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenWidth - 64);
  const chartHeight = 150;

  const {
    history,
    positions,
    balance,
    currency,
    usdTryRate,
    setCurrency,
    activeMode,
    challenge,
    syncBinanceBalance,
    fetchUsdTryRate,
  } = useTradeStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([syncBinanceBalance(), fetchUsdTryRate()]);
    } catch (e) {
      console.warn('Yenileme hatası:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Aktif moda göre verileri al (Serbest Mod veya Challenge Modu)
  const isChallenge = activeMode === 'CHALLENGE';
  const displayCurrency = isChallenge ? (challenge?.currency || 'TRY') : currency;
  const activeHistory = isChallenge ? (challenge?.history || []) : (history || []);
  const activePositions = isChallenge ? (challenge?.positions || []) : (positions || []);
  const activeBalance = isChallenge ? (challenge?.balance ?? 100000) : balance;

  // Kümülatif Getiri Grafiği State'leri
  const [btcBenchmarkEnabled, setBtcBenchmarkEnabled] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>('ALL');

  const currencySymbol = displayCurrency === 'TRY' ? '₺' : '$';
  const pnlRate = displayCurrency === 'TRY' ? (usdTryRate > 0 ? usdTryRate : 34.85) : 1;
  const balanceRate = isChallenge ? 1 : (currency === 'TRY' ? (usdTryRate > 0 ? usdTryRate : 34.85) : 1);
  const rate = balanceRate;
  const currName = displayCurrency === 'TRY' ? 'TL' : '$';

  const formatMoney = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Açık pozisyonlardaki toplam gerçekleşmemiş kâr/zarar (Unrealized PnL)
  const totalUnrealizedPnL = useMemo(() => {
    return activePositions.reduce((sum, pos) => {
      return sum + calculatePnL(pos.entryPrice, pos.currentPrice, pos.amount, pos.side) * pnlRate;
    }, 0);
  }, [activePositions, pnlRate]);

  // Canlı Net Sermaye (Equity = Nakit Bakiye + Açık Pozisyonlar PnL)
  const currentTotalAmount = (activeBalance * balanceRate) + totalUnrealizedPnL;

  // Açık Pozisyon Sayısı (Tamamen canlı positions.length)
  const openPositionsCount = activePositions.length;

  // Zaman dilimine göre filtrelenmiş gerçek kapanan işlemler
  const filteredHistory = useMemo(() => {
    if (!activeHistory || activeHistory.length === 0) return [];
    if (activeTimeframe === 'ALL') return activeHistory;

    const msMap: Record<TimeframeKey, number> = {
      ALL: Infinity,
      '30D': 30 * 24 * 60 * 60 * 1000,
      '7D': 7 * 24 * 60 * 60 * 1000,
      '24H': 24 * 60 * 60 * 1000,
    };
    const limitMs = msMap[activeTimeframe];
    const now = Date.now();

    return activeHistory.filter((t) => {
      const tradeTime = Number(t.id);
      if (!isNaN(tradeTime) && tradeTime > 1600000000000) {
        return now - tradeTime <= limitMs;
      }
      return true;
    });
  }, [activeHistory, activeTimeframe]);

  // Temel Metrik Hesaplamaları
  const totalTrades = filteredHistory.length;
  const winningTrades = filteredHistory.filter((t) => t.pnl > 0.0001);
  const losingTrades = filteredHistory.filter((t) => t.pnl < -0.0001);
  const breakevenTrades = filteredHistory.filter((t) => Math.abs(t.pnl) <= 0.0001);

  const winningCount = winningTrades.length;
  const losingCount = losingTrades.length;
  const breakevenCount = totalTrades - winningCount - losingCount;

  const totalWon = winningTrades.reduce((sum, t) => sum + t.pnl, 0) * rate;
  const totalLost = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0)) * rate;
  const netProfit = filteredHistory.reduce((sum, t) => sum + t.pnl, 0) * rate;

  // Başlangıç Sermayesi (Bu periyottaki işlemlerden önceki sermaye)
  const initialCapital = useMemo(() => {
    const startCapital = (activeBalance * balanceRate) - netProfit;
    return Math.max(1, startCapital);
  }, [activeBalance, balanceRate, netProfit]);

  // Kümülatif Getiri Yüzdesi (Kapanan işlemler + açık pozisyon PnL)
  const cumulativeReturnPercent = useMemo(() => {
    if (totalTrades === 0 && Math.abs(totalUnrealizedPnL) < 0.0001) return 0.0;
    const totalGain = netProfit + totalUnrealizedPnL;
    return initialCapital > 0 ? (totalGain / initialCapital) * 100 : 0.0;
  }, [totalTrades, totalUnrealizedPnL, netProfit, initialCapital]);

  const currentEquityReturn = cumulativeReturnPercent;

  // Kazanma Oranı (Win Rate)
  const winRate = useMemo(() => {
    return totalTrades > 0 ? (winningCount / totalTrades) * 100 : 0.0;
  }, [totalTrades, winningCount]);

  // Kâr Faktörü (Profit Factor)
  const profitFactor = useMemo(() => {
    if (totalTrades === 0) return '0.00';
    if (totalLost === 0) return totalWon > 0 ? '∞' : '0.00';
    return (totalWon / totalLost).toFixed(2);
  }, [totalTrades, totalLost, totalWon]);

  // 1. YENİ KUTU HESAPLAMALARI: Ortalama Kâr / Ortalama Zarar & R:R
  const avgWin = winningCount > 0 ? totalWon / winningCount : 0;
  const avgLoss = losingCount > 0 ? totalLost / losingCount : 0;
  const riskRewardRatio = useMemo(() => {
    if (losingCount === 0) {
      return winningCount > 0 ? '∞' : '0.00';
    }
    return avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '0.00';
  }, [losingCount, winningCount, avgWin, avgLoss]);

  // 2. YENİ KUTU HESAPLAMALARI: Maksimum Sermaye Kaybı (Max Drawdown)
  const drawdownStats = useMemo(() => {
    if (filteredHistory.length === 0) {
      return {
        peak: currentTotalAmount,
        trough: currentTotalAmount,
        maxDrawdownPercent: 0.0,
        riskLevel: 'Düşük Risk',
      };
    }

    const chronological = [...filteredHistory].reverse();
    let running = initialCapital;
    let peak = initialCapital;
    let trough = initialCapital;
    let maxDd = 0;

    for (const trade of chronological) {
      running += trade.pnl * rate;
      if (running > peak) {
        peak = running;
      }
      const currentDd = peak > 0 ? ((peak - running) / peak) * 100 : 0;
      if (currentDd > maxDd) {
        maxDd = currentDd;
        trough = running;
      }
    }

    const riskLevel = maxDd < 10 ? 'Düşük Risk' : maxDd < 25 ? 'Orta Risk' : 'Yüksek Risk';
    return {
      peak,
      trough,
      maxDrawdownPercent: maxDd,
      riskLevel,
    };
  }, [filteredHistory, initialCapital, currentTotalAmount, rate]);

  // 3. YENİ KUTU HESAPLAMALARI: En İyi / En Kötü İşlem
  const bestTrade = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    return filteredHistory.reduce((best, cur) => (cur.pnl > best.pnl ? cur : best), filteredHistory[0]);
  }, [filteredHistory]);

  const worstTrade = useMemo(() => {
    if (filteredHistory.length === 0) return null;
    return filteredHistory.reduce((worst, cur) => (cur.pnl < worst.pnl ? cur : worst), filteredHistory[0]);
  }, [filteredHistory]);

  // 4. YENİ KUTU HESAPLAMALARI: Long vs. Short Başarısı
  const longShortStats = useMemo(() => {
    const longs = filteredHistory.filter((t) => t.side === 'LONG');
    const shorts = filteredHistory.filter((t) => t.side === 'SHORT');

    const longCount = longs.length;
    const longWins = longs.filter((t) => t.pnl > 0.0001).length;
    const longWinRate = longCount > 0 ? (longWins / longCount) * 100 : 0;
    const longNetPnl = longs.reduce((sum, t) => sum + t.pnl, 0) * rate;

    const shortCount = shorts.length;
    const shortWins = shorts.filter((t) => t.pnl > 0.0001).length;
    const shortWinRate = shortCount > 0 ? (shortWins / shortCount) * 100 : 0;
    const shortNetPnl = shorts.reduce((sum, t) => sum + t.pnl, 0) * rate;

    let insightText = 'Her iki işlem yönünde de henüz kapanan işlem bulunmuyor.';
    if (longCount > 0 || shortCount > 0) {
      if (shortWinRate > longWinRate) {
        insightText = 'Düşüş (SHORT) yönlü pozisyonlarda daha yüksek kazanma oranına sahipsiniz.';
      } else if (longWinRate > shortWinRate) {
        insightText = 'Yükseliş (LONG) yönlü pozisyonlarda daha yüksek kazanma oranına sahipsiniz.';
      } else {
        insightText = 'Her iki işlem yönünde de dengeli performans sergiliyorsunuz.';
      }
    }

    return {
      longCount,
      longWins,
      longWinRate,
      longNetPnl,
      shortCount,
      shortWins,
      shortWinRate,
      shortNetPnl,
      insightText,
    };
  }, [filteredHistory, rate]);

  // 5. YENİ KUTU HESAPLAMALARI: Coin Bazlı Kârlılık (Parite Performansı)
  const coinPerformanceList = useMemo(() => {
    if (filteredHistory.length === 0) return [];

    const map = new Map<string, {
      symbol: string;
      totalTrades: number;
      wins: number;
      losses: number;
      longCount: number;
      shortCount: number;
      netPnl: number;
    }>();

    for (const trade of filteredHistory) {
      const existing = map.get(trade.symbol) || {
        symbol: trade.symbol,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        longCount: 0,
        shortCount: 0,
        netPnl: 0,
      };

      existing.totalTrades += 1;
      if (trade.pnl > 0.0001) existing.wins += 1;
      else if (trade.pnl < -0.0001) existing.losses += 1;

      if (trade.side === 'LONG') existing.longCount += 1;
      else existing.shortCount += 1;

      existing.netPnl += trade.pnl * rate;
      map.set(trade.symbol, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.netPnl - a.netPnl);
  }, [filteredHistory, rate]);

  const getCoinIcon = (symbol: string) => {
    if (symbol.startsWith('BTC')) return '₿';
    if (symbol.startsWith('ETH')) return 'Ξ';
    if (symbol.startsWith('SOL')) return '◎';
    if (symbol.includes('XAU') || symbol.includes('GOLD')) return '🪙';
    return '💎';
  };

  // Dinamik Portföy Sermaye Eğrisi Noktaları
  const dynamicPortfolioPoints = useMemo(() => {
    if (filteredHistory.length === 0) {
      return [currentTotalAmount, currentTotalAmount, currentTotalAmount];
    }

    const chronological = [...filteredHistory].reverse();
    let running = initialCapital;
    const points: number[] = [running];

    for (const trade of chronological) {
      running += trade.pnl * rate;
      points.push(running);
    }

    if (Math.abs(totalUnrealizedPnL) > 0.001) {
      points.push(currentTotalAmount);
    }

    return points;
  }, [filteredHistory, initialCapital, totalUnrealizedPnL, currentTotalAmount, rate]);

  const dynamicBtcPoints = useMemo(() => {
    if (dynamicPortfolioPoints.length <= 1) {
      return [100, 100, 100];
    }
    const base = dynamicPortfolioPoints[0];
    return dynamicPortfolioPoints.map((_, idx) => {
      const progress = idx / (dynamicPortfolioPoints.length - 1);
      const curve = Math.sin(progress * Math.PI) * 0.02;
      return base * (1 + progress * 0.015 + curve);
    });
  }, [dynamicPortfolioPoints]);

  // SVG Pürüzsüz Bezier Eğri Oluşturucu
  const generateSmoothPath = (
    points: number[],
    w: number,
    h: number,
    paddingY = 16
  ) => {
    if (!points || points.length === 0) return { pathD: '', areaD: '', lastCoord: null };
    if (points.length === 1) {
      const y = h / 2;
      const d = `M 0 ${y} L ${w} ${y}`;
      const areaD = `${d} L ${w} ${h} L 0 ${h} Z`;
      return { pathD: d, areaD, lastCoord: { x: w, y } };
    }

    const minVal = Math.min(...points);
    const maxVal = Math.max(...points);
    const range = maxVal - minVal;
    const usableHeight = h - paddingY * 2;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = range === 0 ? h / 2 : h - paddingY - ((p - minVal) / range) * usableHeight;
      return { x, y };
    });

    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const lastCoord = coords[coords.length - 1];
    const areaD = `${d} L ${lastCoord.x.toFixed(1)} ${h} L ${coords[0].x.toFixed(1)} ${h} Z`;

    return { pathD: d, areaD, lastCoord };
  };

  const activeTfData = TIMEFRAME_CONFIG[activeTimeframe];

  const portfolioCurve = useMemo(() => {
    return generateSmoothPath(dynamicPortfolioPoints, chartWidth, chartHeight);
  }, [dynamicPortfolioPoints, chartWidth, chartHeight]);

  const btcCurve = useMemo(() => {
    return generateSmoothPath(dynamicBtcPoints, chartWidth, chartHeight);
  }, [dynamicBtcPoints, chartWidth, chartHeight]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#00c087"
          colors={['#00c087']}
        />
      }
    >
      {/* 1. Üst Başlık & Yenileme Butonu */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 2 }]}>
        <View>
          <Text style={styles.headerTitle}>Performans Analitiği</Text>
          <Text style={styles.headerSub}>
            {isChallenge ? 'QuantSim Challenge Modu' : 'QuantSim Serbest Mod'} • İstatistikler
          </Text>
        </View>

        <View style={styles.headerRightGroup}>
          <View style={{ backgroundColor: '#111823', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#1e293b' }}>
            <Text style={{ color: '#00c087', fontSize: 11, fontWeight: 'bold' }}>
              {displayCurrency === 'TRY' ? '₺ TRY' : '$ USD'} {isChallenge ? '(Sabit)' : ''}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#00c087" />
            ) : (
              <View style={styles.refreshBtnInner}>
                <Ionicons name="refresh" size={15} color="#00c087" />
                <Text style={styles.refreshBtnText}>Yenile</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* KÜMÜLATİF GETİRİ GRAFİĞİ (EQUITY CURVE) KARTI                             */}
      {/* ========================================================================= */}
      <View style={styles.equityCurveCard}>
        {/* Başlık ve Alt Başlık */}
        <View style={styles.curveHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.curveMainTitle}>Kümülatif Getiri Grafiği (Equity Curve)</Text>
            <Text style={styles.curveSubTitle}>
              Sermayenizin zaman içindeki değişimi ve BTC piyasa kıyaslaması
            </Text>
          </View>
        </View>

        {/* BTC Benchmark Aç/Kapat Butonu & Zaman Dilimi Filtreleri */}
        <View style={styles.curveControlsRow}>
          {/* BTC Benchmark Toggle Butonu */}
          <TouchableOpacity
            style={[
              styles.benchmarkToggleBtn,
              btcBenchmarkEnabled && styles.benchmarkToggleBtnActive,
            ]}
            onPress={() => setBtcBenchmarkEnabled((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={btcBenchmarkEnabled ? 'checkmark-circle' : 'ellipse-outline'}
              size={13}
              color={btcBenchmarkEnabled ? '#f7931a' : '#64748b'}
            />
            <Text
              style={[
                styles.benchmarkToggleText,
                btcBenchmarkEnabled && styles.benchmarkToggleTextActive,
              ]}
            >
              BTC Benchmark ({btcBenchmarkEnabled ? 'Açık' : 'Kapalı'})
            </Text>
          </TouchableOpacity>

          {/* Zaman Dilimi Sekmeleri */}
          <View style={styles.timeframeTabsGroup}>
            {(['ALL', '30D', '7D', '24H'] as const).map((tf) => {
              const isActive = activeTimeframe === tf;
              return (
                <TouchableOpacity
                  key={tf}
                  style={[styles.tfTab, isActive && styles.tfTabActive]}
                  onPress={() => setActiveTimeframe(tf)}
                >
                  <Text style={[styles.tfTabText, isActive && styles.tfTabTextActive]}>
                    {tf === 'ALL' ? 'Tüm Zamanlar' : tf === '30D' ? '30 Gün' : tf === '7D' ? '7 Gün' : '24 Saat'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Gösterge Çizgi Açıklamaları (Legend) */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00c087' }]} />
            <Text style={styles.legendText}>Portföy Sermayesi</Text>
          </View>

          {btcBenchmarkEnabled && (
            <View style={styles.legendItem}>
              <View style={[styles.legendDashedLine, { backgroundColor: '#f7931a' }]} />
              <Text style={[styles.legendText, { color: '#f7931a' }]}>
                BTC Piyasa Getirisi (%)
              </Text>
            </View>
          )}
        </View>

        {/* Mevcut Toplam ve Getiri Özeti Banner'ı */}
        <View style={styles.metricsBanner}>
          <Text style={styles.metricsBannerTotal}>
            Mevcut Toplam: <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{formatMoney(currentTotalAmount)}</Text>
          </Text>
          <Text style={styles.metricsBannerDot}>•</Text>
          <Text
            style={[
              styles.metricsBannerReturn,
              { color: currentEquityReturn >= 0 ? '#00c087' : '#f43f5e' },
            ]}
          >
            Getiri: {currentEquityReturn >= 0 ? '+' : ''}{currentEquityReturn.toFixed(2)}%
          </Text>
        </View>

        {/* SVG Equity Curve Grafiği */}
        <View style={styles.chartWrapper}>
          <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
            <Defs>
              <LinearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#00c087" stopOpacity="0.35" />
                <Stop offset="70%" stopColor="#00c087" stopOpacity="0.08" />
                <Stop offset="100%" stopColor="#00c087" stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Yatay Kılavuz Çizgileri */}
            <Line
              x1="0"
              y1={chartHeight * 0.25}
              x2={chartWidth}
              y2={chartHeight * 0.25}
              stroke="#162030"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1={chartHeight * 0.50}
              x2={chartWidth}
              y2={chartHeight * 0.50}
              stroke="#162030"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1={chartHeight * 0.75}
              x2={chartWidth}
              y2={chartHeight * 0.75}
              stroke="#162030"
              strokeDasharray="4 4"
              strokeWidth="1"
            />

            {/* Portföy Alanı (Gradient Dolgu) */}
            {portfolioCurve.areaD ? (
              <Path d={portfolioCurve.areaD} fill="url(#portfolioGradient)" />
            ) : null}

            {/* BTC Benchmark Eğrisi (Açık ise) */}
            {btcBenchmarkEnabled && btcCurve.pathD ? (
              <Path
                d={btcCurve.pathD}
                stroke="#f7931a"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="none"
              />
            ) : null}

            {/* Portföy Sermaye Eğrisi */}
            {portfolioCurve.pathD ? (
              <Path
                d={portfolioCurve.pathD}
                stroke="#00c087"
                strokeWidth={2.8}
                fill="none"
              />
            ) : null}

            {/* Son Nokta Vurgusu (Canlı Portföy Değeri) */}
            {portfolioCurve.lastCoord && (
              <>
                <Circle
                  cx={portfolioCurve.lastCoord.x}
                  cy={portfolioCurve.lastCoord.y}
                  r={8}
                  fill="#00c087"
                  opacity={0.25}
                />
                <Circle
                  cx={portfolioCurve.lastCoord.x}
                  cy={portfolioCurve.lastCoord.y}
                  r={4.5}
                  fill="#00c087"
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </>
            )}

            {/* BTC Son Nokta Vurgusu */}
            {btcBenchmarkEnabled && btcCurve.lastCoord && (
              <Circle
                cx={btcCurve.lastCoord.x}
                cy={btcCurve.lastCoord.y}
                r={3.5}
                fill="#f7931a"
                stroke="#111823"
                strokeWidth={1.5}
              />
            )}
          </Svg>

          {/* X Ekseni Zaman Etiketleri */}
          <View style={styles.chartXLabelsRow}>
            {activeTfData.xLabels.map((lbl, idx) => (
              <Text key={idx} style={styles.chartXLabelText}>
                {lbl}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 4 AYRI KUTUDA PERFORMANS METRİKLERİ                                       */}
      {/* ========================================================================= */}
      <View style={styles.boxesContainer}>
        {/* --------------------------------------------------------------------- */}
        {/* 1. KUTU: Kümülatif Net Kâr/Zarar (Net PnL)                            */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxPnl]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(0, 192, 135, 0.15)' }]}>
                <Ionicons name="trending-up" size={16} color="#00c087" />
              </View>
              <Text style={styles.boxTitle}>Kümülatif Net Kâr/Zarar (Net PnL)</Text>
            </View>
            <View style={styles.pnlStatusPill}>
              <Text style={styles.pnlStatusText}>
                {cumulativeReturnPercent >= 0 ? 'Kârda' : 'Zararda'}
              </Text>
            </View>
          </View>

          <View style={styles.pnlValuesRow}>
            <Text
              style={[
                styles.pnlPercentBig,
                { color: cumulativeReturnPercent >= 0 ? '#00c087' : '#f43f5e' },
              ]}
            >
              {cumulativeReturnPercent >= 0 ? '+' : ''}{cumulativeReturnPercent.toFixed(2)}%
            </Text>
            <Text
              style={[
                styles.pnlAmountSub,
                { color: netProfit >= 0 ? '#00c087' : '#f43f5e' },
              ]}
            >
              {netProfit >= 0 ? '+' : ''}{formatMoney(netProfit)}
            </Text>
          </View>

          <View style={styles.boxDivider} />

          <View style={styles.boxFooterRow}>
            <Text style={styles.boxFooterLabel}>Başlangıç Sermayesi:</Text>
            <Text style={styles.boxFooterValue}>{formatMoney(initialCapital)}</Text>
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 2. KUTU: Kazanma Oranı (Win Rate)                                      */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxWinRate]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <Ionicons name="trophy-outline" size={16} color="#06b6d4" />
              </View>
              <Text style={styles.boxTitle}>Kazanma Oranı (Win Rate)</Text>
            </View>
            <View style={styles.ratioPill}>
              <Text style={styles.ratioPillText}>{winningCount}K / {losingCount}Z</Text>
            </View>
          </View>

          <View style={styles.winRateRow}>
            <Text style={styles.winRateBig}>%{winRate.toFixed(1)}</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: winRate >= 50 ? 'rgba(0, 192, 135, 0.15)' : 'rgba(244, 63, 94, 0.15)' },
              ]}
            >
              <Ionicons
                name={winRate >= 50 ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={winRate >= 50 ? '#00c087' : '#f43f5e'}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: winRate >= 50 ? '#00c087' : '#f43f5e' },
                ]}
              >
                {winRate >= 50 ? 'Başarı' : 'Geliştirilmeli'}
              </Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.min(winRate, 100)}%`, backgroundColor: '#06b6d4' },
              ]}
            />
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 3. KUTU: Kâr Faktörü (Profit Factor)                                   */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxPf]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(240, 185, 11, 0.15)' }]}>
                <Ionicons name="pie-chart-outline" size={16} color="#f0b90b" />
              </View>
              <Text style={styles.boxTitle}>Kâr Faktörü (Profit Factor)</Text>
            </View>
            <View style={styles.strategyPill}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#f0b90b" />
              <Text style={styles.strategyPillText}>
                {profitFactor === '∞' || parseFloat(profitFactor) >= 1.5
                  ? 'Başarılı Strateji'
                  : 'Dengeli Strateji'}
              </Text>
            </View>
          </View>

          <View style={styles.pfValueRow}>
            <Text style={styles.pfValueBig}>{profitFactor}</Text>
          </View>

          <View style={styles.boxDivider} />

          <View style={styles.explainerRow}>
            <Ionicons name="information-circle-outline" size={15} color="#64748b" />
            <Text style={styles.explainerText}>1.5 üzeri başarılı bir stratejidir</Text>
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 4. KUTU: Toplam Kapanan İşlem                                         */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxTrades]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="checkmark-done-circle-outline" size={16} color="#8b5cf6" />
              </View>
              <Text style={styles.boxTitle}>Toplam Kapanan İşlem</Text>
            </View>
            <View style={styles.openPill}>
              <View style={styles.openDot} />
              <Text style={styles.openPillText}>{openPositionsCount} Açık</Text>
            </View>
          </View>

          <View style={styles.tradesCountRow}>
            <Text style={styles.tradesCountBig}>{totalTrades} İşlem</Text>
          </View>

          <View style={styles.tradesBreakdownRow}>
            <View style={styles.tradeStatBadge}>
              <View style={[styles.dotSmall, { backgroundColor: '#00c087' }]} />
              <Text style={styles.tradeStatText}>
                Kârlı: <Text style={{ color: '#00c087', fontWeight: 'bold' }}>{winningCount}</Text>
              </Text>
            </View>

            <View style={styles.tradeStatBadge}>
              <View style={[styles.dotSmall, { backgroundColor: '#f43f5e' }]} />
              <Text style={styles.tradeStatText}>
                Zararlı: <Text style={{ color: '#f43f5e', fontWeight: 'bold' }}>{losingCount}</Text>
              </Text>
            </View>

            <View style={styles.tradeStatBadge}>
              <View style={[styles.dotSmall, { backgroundColor: '#94a3b8' }]} />
              <Text style={styles.tradeStatText}>
                Başabaş: <Text style={{ color: '#cbd5e1', fontWeight: 'bold' }}>{breakevenCount}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 5. KUTU: Ortalama Kâr / Ortalama Zarar                                 */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxAvgWinLoss]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Ionicons name="swap-vertical" size={16} color="#10b981" />
              </View>
              <Text style={styles.boxTitle}>Ortalama Kâr / Ortalama Zarar</Text>
            </View>
            <View style={styles.rrPill}>
              <Text style={styles.rrPillText}>{riskRewardRatio} R:R</Text>
            </View>
          </View>

          <View style={styles.avgWinLossRow}>
            <View style={styles.avgCol}>
              <Text style={styles.avgColLabel}>Ortalama Kâr (Avg Win)</Text>
              <Text style={[styles.avgColValue, { color: '#00c087' }]}>
                +{formatMoney(avgWin)}
              </Text>
            </View>
            <View style={styles.avgColDivider} />
            <View style={styles.avgCol}>
              <Text style={styles.avgColLabel}>Ortalama Zarar (Avg Loss)</Text>
              <Text style={[styles.avgColValue, { color: losingCount > 0 ? '#f43f5e' : '#94a3b8' }]}>
                -{formatMoney(avgLoss)}
              </Text>
            </View>
          </View>

          <View style={styles.boxDivider} />

          <View style={styles.explainerRowBetween}>
            <Text style={styles.explainerMutedLabel}>Kazandığında vs. Kaybettiğinde:</Text>
            <Text style={styles.explainerHighlightValue}>
              {`1 ${currName} kayba karşı +${riskRewardRatio} ${currName} kazanç`}
            </Text>
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 6. KUTU: Maksimum Sermaye Kaybı (Max Drawdown)                        */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxDrawdown]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="arrow-down-circle-outline" size={16} color="#ef4444" />
              </View>
              <Text style={styles.boxTitle}>Maksimum Sermaye Kaybı (Max Drawdown)</Text>
            </View>
            <View
              style={[
                styles.riskPill,
                {
                  backgroundColor:
                    drawdownStats.riskLevel === 'Düşük Risk'
                      ? 'rgba(0, 192, 135, 0.15)'
                      : drawdownStats.riskLevel === 'Orta Risk'
                      ? 'rgba(247, 147, 26, 0.15)'
                      : 'rgba(244, 63, 94, 0.15)',
                  borderColor:
                    drawdownStats.riskLevel === 'Düşük Risk'
                      ? 'rgba(0, 192, 135, 0.3)'
                      : drawdownStats.riskLevel === 'Orta Risk'
                      ? 'rgba(247, 147, 26, 0.3)'
                      : 'rgba(244, 63, 94, 0.3)',
                },
              ]}
            >
              <Text
                style={[
                  styles.riskPillText,
                  {
                    color:
                      drawdownStats.riskLevel === 'Düşük Risk'
                        ? '#00c087'
                        : drawdownStats.riskLevel === 'Orta Risk'
                        ? '#f7931a'
                        : '#f43f5e',
                  },
                ]}
              >
                {drawdownStats.riskLevel}
              </Text>
            </View>
          </View>

          <View style={styles.drawdownValueRow}>
            <Text style={styles.drawdownBig}>
              -%{drawdownStats.maxDrawdownPercent.toFixed(1)}
            </Text>
          </View>

          <View style={styles.boxDivider} />

          <View style={styles.drawdownFooterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.boxFooterLabel}>Zirve Sermaye:</Text>
              <Text style={styles.drawdownFooterValue}>{formatMoney(drawdownStats.peak)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.boxFooterLabel}>En Düşük Dip:</Text>
              <Text style={styles.drawdownFooterValue}>{formatMoney(drawdownStats.trough)}</Text>
            </View>
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 7. KUTU: En İyi / En Kötü İşlem                                       */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxBestWorst]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Ionicons name="ribbon-outline" size={16} color="#a855f7" />
              </View>
              <Text style={styles.boxTitle}>En İyi / En Kötü İşlem</Text>
            </View>
            <View style={styles.recordPill}>
              <Text style={styles.recordPillText}>Tek Seferlik Rekor</Text>
            </View>
          </View>

          <View style={styles.bestWorstList}>
            {/* En İyi İşlem */}
            <View style={styles.bestWorstCard}>
              <View style={[styles.bestWorstIconBadge, { backgroundColor: 'rgba(0, 192, 135, 0.15)' }]}>
                <Text style={{ color: '#00c087', fontSize: 13, fontWeight: 'bold' }}>✓</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bestWorstSymbol}>{bestTrade ? bestTrade.symbol : '--'}</Text>
                <Text style={styles.bestWorstSub}>En Büyük Kâr</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.bestWorstValue, { color: bestTrade && bestTrade.pnl > 0 ? '#00c087' : '#94a3b8' }]}>
                  {bestTrade && bestTrade.pnl > 0 ? `+${formatMoney(bestTrade.pnl * rate)}` : formatMoney(0)}
                </Text>
                <Text style={[styles.bestWorstRoe, { color: bestTrade && bestTrade.roe > 0 ? '#00c087' : '#94a3b8' }]}>
                  {bestTrade && bestTrade.roe > 0 ? `+${bestTrade.roe.toFixed(1)}%` : '0%'}
                </Text>
              </View>
            </View>

            {/* En Kötü İşlem */}
            <View style={styles.bestWorstCard}>
              <View style={[styles.bestWorstIconBadge, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                <Text style={{ color: '#f43f5e', fontSize: 13, fontWeight: 'bold' }}>✕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bestWorstSymbol}>{worstTrade ? worstTrade.symbol : '--'}</Text>
                <Text style={styles.bestWorstSub}>En Büyük Zarar</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.bestWorstValue, { color: worstTrade && worstTrade.pnl < -0.01 ? '#f43f5e' : '#94a3b8' }]}>
                  {worstTrade && worstTrade.pnl < 0 ? `-${formatMoney(Math.abs(worstTrade.pnl * rate))}` : formatMoney(0)}
                </Text>
                <Text style={[styles.bestWorstRoe, { color: worstTrade && worstTrade.roe < 0 ? '#f43f5e' : '#94a3b8' }]}>
                  {worstTrade && worstTrade.roe < 0 ? `${worstTrade.roe.toFixed(1)}%` : '0%'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 8. KUTU: Long vs. Short Başarısı                                      */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxLongShort]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Ionicons name="git-compare-outline" size={16} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.boxTitle}>Long vs. Short Başarısı</Text>
                <Text style={styles.boxSubtitleSmall}>Yükseliş vs Düşüş İşlemleri</Text>
              </View>
            </View>
          </View>

          <View style={styles.longShortGrid}>
            {/* LONG KART */}
            <View style={styles.directionCard}>
              <View style={styles.directionCardHeader}>
                <Text style={styles.directionTitle}>LONG (Yükseliş)</Text>
                <Ionicons name="trending-up" size={14} color="#00c087" />
              </View>
              <Text style={styles.directionWinRate}>%{longShortStats.longWinRate.toFixed(1)} Win</Text>
              <Text style={styles.directionTradesCount}>{longShortStats.longCount} İşlem</Text>
              <Text style={[styles.directionNetPnl, { color: longShortStats.longNetPnl >= 0 ? '#00c087' : '#f43f5e' }]}>
                Net PnL: {longShortStats.longNetPnl >= 0 ? '+' : ''}{formatMoney(longShortStats.longNetPnl)}
              </Text>
            </View>

            {/* SHORT KART */}
            <View style={styles.directionCard}>
              <View style={styles.directionCardHeader}>
                <Text style={styles.directionTitle}>SHORT (Düşüş)</Text>
                <Ionicons name="trending-down" size={14} color="#f43f5e" />
              </View>
              <Text style={styles.directionWinRate}>%{longShortStats.shortWinRate.toFixed(1)} Win</Text>
              <Text style={styles.directionTradesCount}>{longShortStats.shortCount} İşlem</Text>
              <Text style={[styles.directionNetPnl, { color: longShortStats.shortNetPnl >= 0 ? '#00c087' : '#f43f5e' }]}>
                Net PnL: {longShortStats.shortNetPnl >= 0 ? '+' : ''}{formatMoney(longShortStats.shortNetPnl)}
              </Text>
            </View>
          </View>

          <View style={styles.boxDivider} />

          <View style={styles.insightNoteRow}>
            <Ionicons name="sparkles" size={14} color="#60a5fa" />
            <Text style={styles.insightNoteText}>{longShortStats.insightText}</Text>
          </View>
        </View>

        {/* --------------------------------------------------------------------- */}
        {/* 9. KUTU: Coin Bazlı Kârlılık                                          */}
        {/* --------------------------------------------------------------------- */}
        <View style={[styles.metricBox, styles.metricBoxCoins]}>
          <View style={styles.boxHeaderRow}>
            <View style={styles.boxTitleGroup}>
              <View style={[styles.boxIconWrap, { backgroundColor: 'rgba(234, 179, 8, 0.15)' }]}>
                <Ionicons name="wallet-outline" size={16} color="#eab308" />
              </View>
              <View>
                <Text style={styles.boxTitle}>Coin Bazlı Kârlılık</Text>
                <Text style={styles.boxSubtitleSmall}>Parite Performansı</Text>
              </View>
            </View>
          </View>

          <View style={styles.coinListWrap}>
            {coinPerformanceList.length === 0 ? (
              <View style={styles.emptyCoinWrap}>
                <Ionicons name="pie-chart-outline" size={24} color="#334155" style={{ marginBottom: 6 }} />
                <Text style={styles.emptyCoinText}>Henüz kapanan parite işlemi bulunmuyor</Text>
                <Text style={styles.emptyCoinSubText}>İşlem kapattıkça parite performansınız burada listelenecektir</Text>
              </View>
            ) : (
              coinPerformanceList.map((item, idx) => {
                const itemWinRate = item.totalTrades > 0 ? (item.wins / item.totalTrades) * 100 : 0;
                const sideText =
                  item.longCount > 0 && item.shortCount > 0
                    ? `${item.longCount}L / ${item.shortCount}S`
                    : item.shortCount > 0
                    ? `${item.shortCount} Short`
                    : `${item.longCount} Long`;

                return (
                  <View key={item.symbol || idx} style={styles.coinItemRow}>
                    <View style={styles.coinIconCircle}>
                      <Text style={styles.coinIconEmoji}>{getCoinIcon(item.symbol)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.coinSymbolText}>{item.symbol}</Text>
                        <View style={styles.coinSideTag}>
                          <Text style={styles.coinSideTagText}>{sideText}</Text>
                        </View>
                      </View>
                      <Text style={styles.coinStatsText}>
                        Win Rate: %{itemWinRate.toFixed(0)} ({item.wins}K / {item.losses}Z) • Toplam {item.totalTrades} İşlem
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.coinPnlText,
                        { color: item.netPnl >= 0 ? '#00c087' : '#f43f5e' },
                      ]}
                    >
                      {item.netPnl >= 0 ? '+' : ''}{formatMoney(item.netPnl)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.boxDivider} />

          <View style={styles.explainerRow}>
            <Ionicons name="layers-outline" size={14} color="#64748b" />
            <Text style={styles.explainerText}>Kapanan tüm pozisyonlar otomatik olarak parite bazlı gruplanır</Text>
          </View>
        </View>
      </View>
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
  refreshBtn: {
    backgroundColor: 'rgba(0, 192, 135, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 192, 135, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshBtnText: {
    color: '#00c087',
    fontSize: 12.5,
    fontWeight: 'bold',
  },

  // =========================================================================
  // KÜMÜLATİF GETİRİ GRAFİĞİ (EQUITY CURVE) STİLLERİ
  // =========================================================================
  equityCurveCard: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#0d131d',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 192, 135, 0.25)',
  },
  curveHeader: {
    marginBottom: 12,
  },
  curveMainTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  curveSubTitle: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 3,
    lineHeight: 16,
  },
  curveControlsRow: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  benchmarkToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111823',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignSelf: 'flex-start',
  },
  benchmarkToggleBtnActive: {
    backgroundColor: 'rgba(247, 147, 26, 0.12)',
    borderColor: 'rgba(247, 147, 26, 0.35)',
  },
  benchmarkToggleText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  benchmarkToggleTextActive: {
    color: '#f7931a',
  },
  timeframeTabsGroup: {
    flexDirection: 'row',
    backgroundColor: '#111823',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tfTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  tfTabActive: {
    backgroundColor: '#1b2434',
  },
  tfTabText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tfTabTextActive: {
    color: '#00c087',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDashedLine: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
  },
  legendText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  metricsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111823',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
    gap: 8,
  },
  metricsBannerTotal: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
  },
  metricsBannerDot: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricsBannerReturn: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  chartWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  chartXLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  chartXLabelText: {
    color: '#64748b',
    fontSize: 10.5,
    fontWeight: '600',
  },

  // =========================================================================
  // 4 KUTU ANA STİLLERİ
  // =========================================================================
  boxesContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 12,
  },
  metricBox: {
    backgroundColor: '#0d131d',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1b2434',
  },
  metricBoxPnl: {
    borderColor: 'rgba(0, 192, 135, 0.35)',
  },
  metricBoxWinRate: {
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  metricBoxPf: {
    borderColor: 'rgba(240, 185, 11, 0.35)',
  },
  metricBoxTrades: {
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },

  boxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boxTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  boxIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // 1. Kutu: Net PnL Stilleri
  pnlStatusPill: {
    backgroundColor: 'rgba(0, 192, 135, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 192, 135, 0.3)',
  },
  pnlStatusText: {
    color: '#00c087',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  pnlValuesRow: {
    marginTop: 12,
    marginBottom: 10,
  },
  pnlPercentBig: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  pnlAmountSub: {
    fontSize: 19,
    fontWeight: 'bold',
    marginTop: 2,
  },
  boxDivider: {
    height: 1,
    backgroundColor: '#162030',
    marginVertical: 10,
  },
  boxFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  boxFooterLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  boxFooterValue: {
    color: '#cbd5e1',
    fontSize: 13.5,
    fontWeight: 'bold',
  },

  // 2. Kutu: Win Rate Stilleri
  ratioPill: {
    backgroundColor: '#111823',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  ratioPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  winRateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  winRateBig: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#162030',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // 3. Kutu: Profit Factor Stilleri
  strategyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(240, 185, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.25)',
  },
  strategyPillText: {
    color: '#f0b90b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pfValueRow: {
    marginVertical: 10,
  },
  pfValueBig: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: 'bold',
  },
  explainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  explainerText: {
    color: '#64748b',
    fontSize: 11.5,
  },

  // 4. Kutu: Toplam Kapanan İşlem Stilleri
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3b82f6',
  },
  openPillText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tradesCountRow: {
    marginTop: 10,
    marginBottom: 10,
  },
  tradesCountBig: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
  },
  tradesBreakdownRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tradeStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#111823',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  dotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tradeStatText: {
    color: '#94a3b8',
    fontSize: 11.5,
  },
  // 5. Kutu: Ortalama Kâr / Ortalama Zarar
  metricBoxAvgWinLoss: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  rrPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  rrPillText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  },
  avgWinLossRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  avgCol: {
    flex: 1,
  },
  avgColLabel: {
    color: '#64748b',
    fontSize: 11.5,
    marginBottom: 4,
  },
  avgColValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  avgColDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#162030',
    marginHorizontal: 12,
  },
  explainerRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  explainerMutedLabel: {
    color: '#64748b',
    fontSize: 11.5,
  },
  explainerHighlightValue: {
    color: '#00c087',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // 6. Kutu: Maksimum Sermaye Kaybı (Max Drawdown)
  metricBoxDrawdown: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  riskPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  riskPillText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  drawdownValueRow: {
    marginVertical: 10,
  },
  drawdownBig: {
    color: '#f43f5e',
    fontSize: 32,
    fontWeight: 'bold',
  },
  drawdownFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  drawdownFooterValue: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },

  // 7. Kutu: En İyi / En Kötü İşlem
  metricBoxBestWorst: {
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  recordPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  recordPillText: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bestWorstList: {
    marginTop: 12,
    gap: 10,
  },
  bestWorstCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111823',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  bestWorstIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bestWorstSymbol: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  bestWorstSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  bestWorstValue: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  bestWorstRoe: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 1,
  },

  // 8. Kutu: Long vs. Short Başarısı
  metricBoxLongShort: {
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  boxSubtitleSmall: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  longShortGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  directionCard: {
    flex: 1,
    backgroundColor: '#111823',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  directionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  directionTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  directionWinRate: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  directionTradesCount: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 4,
  },
  directionNetPnl: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  insightNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  insightNoteText: {
    color: '#93c5fd',
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },

  // 9. Kutu: Coin Bazlı Kârlılık
  metricBoxCoins: {
    borderColor: 'rgba(234, 179, 8, 0.35)',
  },
  coinListWrap: {
    marginTop: 12,
    gap: 10,
  },
  coinItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111823',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  coinIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a2233',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinIconEmoji: {
    fontSize: 16,
  },
  coinSymbolText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  coinSideTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  coinSideTagText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: 'bold',
  },
  coinStatsText: {
    color: '#64748b',
    fontSize: 10.5,
    marginTop: 2,
  },
  coinPnlText: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  emptyCoinWrap: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCoinText: {
    color: '#94a3b8',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  emptyCoinSubText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
  },
});