import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  fetch24hTicker,
  fetchActiveSymbols,
  fetchCurrentPrice,
  fetchKlines,
  KlineCandle,
  OrderBookData,
  subscribeToLivePrice,
  subscribeToOrderBook,
  Ticker24hData,
} from '../src/services/binance';
import {
  DEFAULT_GLOBAL_MARKET_DATA,
  fetchGlobalMarketData,
  formatCompactCurrency,
  GlobalMarketData,
} from '../src/services/coinmarketcap';
import { DEFAULT_CHALLENGE, useTradeStore } from '../src/store/useTradeStore';
import { calculateLiquidationPrice, calculatePnL, calculateROE } from '../src/utils/math';

interface CryptoPair {
  symbol: string;
  name: string;
  baseAsset: string;
  defaultAmount: string;
}

const AVAILABLE_PAIRS: CryptoPair[] = [
  { symbol: 'BTCUSDT', name: 'BTC/USDT', baseAsset: 'BTC', defaultAmount: '0.05' },
  { symbol: 'ETHUSDT', name: 'ETH/USDT', baseAsset: 'ETH', defaultAmount: '0.5' },
  { symbol: 'SOLUSDT', name: 'SOL/USDT', baseAsset: 'SOL', defaultAmount: '5.0' },
  { symbol: 'BNBUSDT', name: 'BNB/USDT', baseAsset: 'BNB', defaultAmount: '2.0' },
  { symbol: 'DOGEUSDT', name: 'DOGE/USDT', baseAsset: 'DOGE', defaultAmount: '500' },
  { symbol: 'XRPUSDT', name: 'XRP/USDT', baseAsset: 'XRP', defaultAmount: '200' },
  { symbol: 'ADAUSDT', name: 'ADA/USDT', baseAsset: 'ADA', defaultAmount: '100' },
  { symbol: 'AVAXUSDT', name: 'AVAX/USDT', baseAsset: 'AVAX', defaultAmount: '5.0' },
  { symbol: 'LINKUSDT', name: 'LINK/USDT', baseAsset: 'LINK', defaultAmount: '10' },
  { symbol: 'SUIUSDT', name: 'SUI/USDT', baseAsset: 'SUI', defaultAmount: '50' },
  { symbol: 'NEARUSDT', name: 'NEAR/USDT', baseAsset: 'NEAR', defaultAmount: '20' },
  { symbol: 'PEPEUSDT', name: 'PEPE/USDT', baseAsset: 'PEPE', defaultAmount: '1000000' },
  { symbol: 'SHIBUSDT', name: 'SHIB/USDT', baseAsset: 'SHIB', defaultAmount: '500000' },
  { symbol: 'ARBUSDT', name: 'ARB/USDT', baseAsset: 'ARB', defaultAmount: '100' },
  { symbol: 'OPUSDT', name: 'OP/USDT', baseAsset: 'OP', defaultAmount: '50' },
  { symbol: 'APTUSDT', name: 'APT/USDT', baseAsset: 'APT', defaultAmount: '10' },
  { symbol: 'POLUSDT', name: 'POL/USDT', baseAsset: 'POL', defaultAmount: '100' },
  { symbol: 'TIAUSDT', name: 'TIA/USDT', baseAsset: 'TIA', defaultAmount: '20' },
  { symbol: 'INJUSDT', name: 'INJ/USDT', baseAsset: 'INJ', defaultAmount: '5' },
  { symbol: 'RENDERUSDT', name: 'RENDER/USDT', baseAsset: 'RENDER', defaultAmount: '15' },
  { symbol: 'LTCUSDT', name: 'LTC/USDT', baseAsset: 'LTC', defaultAmount: '2' },
  { symbol: 'DOTUSDT', name: 'DOT/USDT', baseAsset: 'DOT', defaultAmount: '20' },
  { symbol: 'UNIUSDT', name: 'UNI/USDT', baseAsset: 'UNI', defaultAmount: '15' },
  { symbol: 'FTMUSDT', name: 'FTM/USDT', baseAsset: 'FTM', defaultAmount: '100' },
  { symbol: 'ATOMUSDT', name: 'ATOM/USDT', baseAsset: 'ATOM', defaultAmount: '15' },
  { symbol: 'ICPUSDT', name: 'ICP/USDT', baseAsset: 'ICP', defaultAmount: '10' },
  { symbol: 'KASUSDT', name: 'KAS/USDT', baseAsset: 'KAS', defaultAmount: '200' },
  { symbol: 'TONUSDT', name: 'TON/USDT', baseAsset: 'TON', defaultAmount: '20' },
  { symbol: 'WIFUSDT', name: 'WIF/USDT', baseAsset: 'WIF', defaultAmount: '50' },
  { symbol: 'BONKUSDT', name: 'BONK/USDT', baseAsset: 'BONK', defaultAmount: '1000000' },
  { symbol: 'FLOKIUSDT', name: 'FLOKI/USDT', baseAsset: 'FLOKI', defaultAmount: '100000' },
  { symbol: 'NOTUSDT', name: 'NOT/USDT', baseAsset: 'NOT', defaultAmount: '10000' },
  { symbol: 'FETUSDT', name: 'FET/USDT', baseAsset: 'FET', defaultAmount: '50' },
  { symbol: 'GALAUSDT', name: 'GALA/USDT', baseAsset: 'GALA', defaultAmount: '500' },
  { symbol: 'SANDUSDT', name: 'SAND/USDT', baseAsset: 'SAND', defaultAmount: '100' },
  { symbol: 'MANAUSDT', name: 'MANA/USDT', baseAsset: 'MANA', defaultAmount: '100' },
  { symbol: 'AAVEUSDT', name: 'AAVE/USDT', baseAsset: 'AAVE', defaultAmount: '1' },
  { symbol: 'MKRUSDT', name: 'MKR/USDT', baseAsset: 'MKR', defaultAmount: '0.1' },
  { symbol: 'CRVUSDT', name: 'CRV/USDT', baseAsset: 'CRV', defaultAmount: '100' },
  { symbol: 'LDOUSDT', name: 'LDO/USDT', baseAsset: 'LDO', defaultAmount: '50' },
  { symbol: 'PENDLEUSDT', name: 'PENDLE/USDT', baseAsset: 'PENDLE', defaultAmount: '25' },
  { symbol: 'JUPUSDT', name: 'JUP/USDT', baseAsset: 'JUP', defaultAmount: '100' },
  { symbol: 'PYTHUSDT', name: 'PYTH/USDT', baseAsset: 'PYTH', defaultAmount: '200' },
  { symbol: 'SEIUSDT', name: 'SEI/USDT', baseAsset: 'SEI', defaultAmount: '100' },
  { symbol: 'STXUSDT', name: 'STX/USDT', baseAsset: 'STX', defaultAmount: '50' },
  { symbol: 'ORDIUSDT', name: 'ORDI/USDT', baseAsset: 'ORDI', defaultAmount: '3' },
  { symbol: 'DYDXUSDT', name: 'DYDX/USDT', baseAsset: 'DYDX', defaultAmount: '50' },
  { symbol: 'IMXUSDT', name: 'IMX/USDT', baseAsset: 'IMX', defaultAmount: '50' },
  { symbol: 'BLURUSDT', name: 'BLUR/USDT', baseAsset: 'BLUR', defaultAmount: '200' },
  { symbol: 'BEAMUSDT', name: 'BEAM/USDT', baseAsset: 'BEAM', defaultAmount: '2000' },
  { symbol: 'BOMEUSDT', name: 'BOME/USDT', baseAsset: 'BOME', defaultAmount: '5000' },
  { symbol: 'BCHUSDT', name: 'BCH/USDT', baseAsset: 'BCH', defaultAmount: '0.5' },
  { symbol: 'ETCUSDT', name: 'ETC/USDT', baseAsset: 'ETC', defaultAmount: '5' },
  { symbol: 'FILUSDT', name: 'FIL/USDT', baseAsset: 'FIL', defaultAmount: '20' },
  { symbol: 'XLMUSDT', name: 'XLM/USDT', baseAsset: 'XLM', defaultAmount: '500' },
  { symbol: 'VETUSDT', name: 'VET/USDT', baseAsset: 'VET', defaultAmount: '1000' },
  { symbol: 'TRXUSDT', name: 'TRX/USDT', baseAsset: 'TRX', defaultAmount: '500' },
  { symbol: 'ALGOUSDT', name: 'ALGO/USDT', baseAsset: 'ALGO', defaultAmount: '200' },
];

const TIMEFRAMES = [
  { label: '1dk', value: '1' },
  { label: '5dk', value: '5' },
  { label: '15dk', value: '15' },
  { label: '30dk', value: '30' },
  { label: '1s', value: '60' },
  { label: '4s', value: '240' },
  { label: '1H', value: 'W' },
  { label: '1A', value: 'M' },
];

const INTERVAL_MAP: Record<string, string> = {
  '1': '1m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '240': '4h',
  'W': '1w',
  'M': '1M',
};

const CHART_HEIGHT = 380;

export default function ChallengeScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPair, setSelectedPair] = useState<CryptoPair>(AVAILABLE_PAIRS[0]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [marginMode, setMarginMode] = useState<'CROSS' | 'ISOLATED'>('CROSS');
  const [leverage, setLeverage] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [activeViewTab, setActiveViewTab] = useState<'CHART' | 'ORDERBOOK'>('CHART');

  // Zaman aralığı & Grafik Üzeri Cetvel
  const [selectedInterval, setSelectedInterval] = useState<string>('15');
  const [candles, setCandles] = useState<KlineCandle[]>([]);
  // TradingView Stili Etkileşimli Cetvel State'leri
  const [isRulerActive, setIsRulerActive] = useState<boolean>(false);
  const [rulerPoint1, setRulerPoint1] = useState<{ x: number; y: number; price: number } | null>(null);
  const [rulerPoint2, setRulerPoint2] = useState<{ x: number; y: number; price: number } | null>(null);
  const [rulerTrackingLive, setRulerTrackingLive] = useState<boolean>(false);
  const [rulerStep, setRulerStep] = useState<0 | 1 | 2>(0);
  const [rulerDragTarget, setRulerDragTarget] = useState<'p1' | 'p2' | 'box' | null>(null);
  const [rulerDragStartPos, setRulerDragStartPos] = useState<{
    x: number;
    y: number;
    p1: { x: number; y: number; price: number };
    p2: { x: number; y: number; price: number };
  } | null>(null);

  // Giriş Kutusu / Seviyesi State'leri (Cetvel gibi açılıp kapanabilir)
  const [isEntryGuideActive, setIsEntryGuideActive] = useState<boolean>(false);
  const [entryGuidePrice, setEntryGuidePrice] = useState<number>(0);

  // Modallar
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showLeverageModal, setShowLeverageModal] = useState<boolean>(false);
  const [showModeModal, setShowModeModal] = useState<boolean>(false);
  const [tempLeverage, setTempLeverage] = useState<number>(10);

  // Parite Arama & Tüm Coinler
  const [pairsList, setPairsList] = useState<CryptoPair[]>(AVAILABLE_PAIRS);
  const [pairSearchQuery, setPairSearchQuery] = useState<string>('');

  // Grafik Referansı & Etkileşim
  const webViewRef = useRef<WebView>(null);
  const [isChartInteracting, setIsChartInteracting] = useState<boolean>(false);

  // 24h Ticker & Order Book & Global CMC Verileri
  const [ticker24h, setTicker24h] = useState<Ticker24hData | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookData>({ bids: [], asks: [] });
  const [globalMarket, setGlobalMarket] = useState<GlobalMarketData>(DEFAULT_GLOBAL_MARKET_DATA);

  // TP / SL (Kâr Al & Zarar Durdur)
  const [isTpSlEnabled, setIsTpSlEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [selectedTpPercent, setSelectedTpPercent] = useState<number | null>(null);
  const [selectedSlPercent, setSelectedSlPercent] = useState<number | null>(null);

  // Store
  const {
    challenge,
    openChallengePosition,
    closeChallengePosition,
    updateChallengePositionTPSL,
    resetChallenge,
    configureChallenge,
    updateMarketPrice,
    usdTryRate,
    activeMode,
    setActiveMode,
    fetchUsdTryRate,
    availableBalance: freeAvailableBalance,
    currency: freeCurrency,
    hasCustomBalance,
  } = useTradeStore();

  const freeCurr = freeCurrency || 'TRY';
  const freeCurrencySymbol = freeCurr === 'TRY' ? '₺' : '$';
  const freeRate = freeCurr === 'TRY' ? (usdTryRate > 0 ? usdTryRate : 34.85) : 1;
  const freeDisplayBalance = (freeAvailableBalance ?? 0) * freeRate;

  const activeChallenge = challenge || DEFAULT_CHALLENGE;
  const isChallengeConfigured = Boolean(activeChallenge.isConfigured);
  const challengeCurrency = activeChallenge.currency || 'TRY';

  // İşlem Marjı Girişi (TRY veya USD cinsinden)
  const [marginInput, setMarginInput] = useState<string>(challengeCurrency === 'USD' ? '100' : '1000');

  // Challenge Kurulum & Sıfırlama Modalları
  const [showSetupModal, setShowSetupModal] = useState<boolean>(!isChallengeConfigured);
  const [setupCurrency, setSetupCurrency] = useState<'TRY' | 'USD'>(challengeCurrency);
  const [setupAmount, setSetupAmount] = useState<string>(challengeCurrency === 'USD' ? '10000' : '100000');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = useState<boolean>(false);
  const [challengeStartedData, setChallengeStartedData] = useState<{ amount: number; currency: 'TRY' | 'USD' } | null>(null);

  // Pozisyon Kapatma ve TP/SL Düzenleme Modalları
  const [closingTargetPos, setClosingTargetPos] = useState<any | null>(null);
  const [editingPos, setEditingPos] = useState<any | null>(null);
  const [editTpInput, setEditTpInput] = useState<string>('');
  const [editSlInput, setEditSlInput] = useState<string>('');

  // 3 Saniyelik Otomatik Kapanan İşlem Başarı Bildirimi (Toast)
  const [orderToast, setOrderToast] = useState<{
    symbol: string;
    side: 'LONG' | 'SHORT';
    leverage: number;
  } | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showOrderToast = (toastSymbol: string, toastSide: 'LONG' | 'SHORT', toastLeverage: number) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setOrderToast({
      symbol: toastSymbol,
      side: toastSide,
      leverage: toastLeverage,
    });
    toastAnim.setValue(0);

    Animated.spring(toastAnim, {
      toValue: 1,
      tension: 70,
      friction: 9,
      useNativeDriver: true,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setOrderToast(null);
      });
    }, 3000);
  };

  const dismissToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    Animated.timing(toastAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setOrderToast(null);
    });
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isChallengeConfigured) {
      const timer = setTimeout(() => {
        setShowSetupModal(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isChallengeConfigured]);

  const symbol = selectedPair.symbol;

  // Binance Klines (Zaman dilimi bazlı mum verileri ile gerçek grafik ölçeği)
  useEffect(() => {
    const binanceInterval = INTERVAL_MAP[selectedInterval] || '15m';
    const loadCandles = () => {
      fetchKlines(symbol, binanceInterval, 70).then((data) => {
        if (data && data.length > 0) {
          setCandles(data);
        }
      });
    };
    loadCandles();
    // Mum verilerini periyodik olarak yenileyerek cetvel ölçeğinin TradingView ile senkronize kalmasını sağla
    const candleTimer = setInterval(loadCandles, 10000);
    return () => clearInterval(candleTimer);
  }, [symbol, selectedInterval]);

  // Grafik Fiyat Ölçeği & Cetvel Hesaplamaları (TradingView mobil görünümündeki ~32 muma göre kalibre edildi)
  const recentCandles = useMemo(() => {
    return candles.length > 32 ? candles.slice(-32) : candles;
  }, [candles]);

  const visibleHigh = useMemo(() => {
    if (recentCandles.length > 0) {
      const candleMax = Math.max(...recentCandles.map((c) => c.high), currentPrice > 0 ? currentPrice : 0);
      return candleMax;
    }
    return currentPrice > 0 ? currentPrice * 1.01 : 100;
  }, [recentCandles, currentPrice]);

  const visibleLow = useMemo(() => {
    if (recentCandles.length > 0) {
      const candleMin = Math.min(...recentCandles.map((c) => c.low), currentPrice > 0 ? currentPrice : Infinity);
      return candleMin;
    }
    return currentPrice > 0 ? currentPrice * 0.99 : 90;
  }, [recentCandles, currentPrice]);

  const priceRange = Math.max(0.000001, visibleHigh - visibleLow);

  // TradingView Mobil Görünümüyle %100 Birebir Kalibre Edilmiş Fiyat Ölçeği (380px Widget)
  // Üst başlık/legend ~30px + %8 margin (26px) = 56px
  // Alt zaman ekseni ~26px + %8 margin (26px) = 328px
  const TV_CANVAS_TOP = 56;
  const TV_CANVAS_BOTTOM = 328;
  const TV_USABLE_HEIGHT = TV_CANVAS_BOTTOM - TV_CANVAS_TOP; // 272px

  // Akıllı ve Hassas Fiyat Formatlayıcı
  const formatSmartPrice = (price: number) => {
    if (price === undefined || price === null || isNaN(price)) return '0.00';
    const abs = Math.abs(price);
    if (abs >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (abs >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    if (abs >= 0.001) return price.toFixed(5);
    if (abs >= 0.00001) return price.toFixed(7);
    return price.toFixed(8);
  };

  const yToPrice = (y: number) => {
    const ratio = (TV_CANVAS_BOTTOM - y) / TV_USABLE_HEIGHT;
    return visibleLow + ratio * priceRange;
  };

  const priceToY = (price: number) => {
    if (priceRange <= 0) return CHART_HEIGHT / 2;
    const ratio = (price - visibleLow) / priceRange;
    return TV_CANVAS_BOTTOM - ratio * TV_USABLE_HEIGHT;
  };

  // TradingView Stili Cetvel Hesaplamaları (Fiyat, Yüzde, Çubuk Sayısı ve Süre)
  // Sabit koordinat sistemi: Tutamaçlar ve çizgiler tam dokunulan Y pikselinde kalır
  const displayP1Y = rulerPoint1 ? rulerPoint1.y : CHART_HEIGHT / 2;
  const displayP2Y = rulerTrackingLive && currentPrice > 0
    ? priceToY(currentPrice)
    : (rulerPoint2 ? rulerPoint2.y : CHART_HEIGHT / 2 - 40);

  // Fiyatlar doğrudan ekrandaki yatay seviyeden (Y koordinatından) dinamik hesaplanır
  const p1Price = rulerPoint1 ? yToPrice(displayP1Y) : currentPrice;
  const p2Price = rulerTrackingLive && currentPrice > 0
    ? currentPrice
    : (rulerPoint2 ? yToPrice(displayP2Y) : (currentPrice > 0 ? currentPrice : p1Price));

  const displayP1X = rulerPoint1 ? rulerPoint1.x : 60;
  const displayP2X = rulerPoint2 ? rulerPoint2.x : 240;

  // İki nokta arası net fiyat farkı ve kesin yüzdelik değişim
  const rulerDiff = p2Price - p1Price;
  const rulerPercent = p1Price > 0 ? (rulerDiff / p1Price) * 100 : 0;

  // TradingView Bar & Süre Formatı
  const rulerBarCount = Math.max(1, Math.round(Math.abs(displayP2X - displayP1X) / 8.5));
  const tfMinutes = selectedInterval === '1' ? 1
    : selectedInterval === '5' ? 5
    : selectedInterval === '15' ? 15
    : selectedInterval === '30' ? 30
    : selectedInterval === '60' ? 60
    : selectedInterval === '240' ? 240
    : selectedInterval === 'W' ? 10080
    : 43200;
  const rulerDurationMinutes = rulerBarCount * tfMinutes;
  const rulerDurationText = rulerDurationMinutes >= 1440
    ? `${Math.floor(rulerDurationMinutes / 1440)}g ${Math.floor((rulerDurationMinutes % 1440) / 60)}s`
    : rulerDurationMinutes >= 60
    ? `${Math.floor(rulerDurationMinutes / 60)}s ${rulerDurationMinutes % 60}d`
    : `${rulerDurationMinutes}d`;

  // Giriş Seviyesi Hesaplamaları (Sadece bu coinde açık pozisyon varsa geçerlidir)
  const currentOpenPosition = (activeChallenge.positions || []).find((p) => p.symbol === symbol);
  const effectiveEntryPrice = currentOpenPosition?.entryPrice || 0;
  const entryGuideY = priceToY(effectiveEntryPrice);
  const entryDiff = effectiveEntryPrice > 0 ? effectiveEntryPrice - currentPrice : 0;

  // Seçili coin değiştiğinde veya o coinde açık pozisyon yoksa giriş çizgisini kapat
  useEffect(() => {
    const hasPosition = (activeChallenge.positions || []).some((p) => p.symbol === symbol);
    if (!hasPosition) {
      setIsEntryGuideActive(false);
    }
  }, [symbol, activeChallenge.positions]);
  const formatPricePrecision = (price: number) => {
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  // Cetvel PanResponder & State Ref (Stale closure hatasını önler, son yToPrice fonksiyonunu kullanır)
  const rulerStateRef = useRef({
    point1: rulerPoint1,
    point2: rulerPoint2,
    dragTarget: rulerDragTarget,
    dragStartPos: rulerDragStartPos,
    yToPrice,
  });

  rulerStateRef.current = {
    point1: rulerPoint1,
    point2: rulerPoint2,
    dragTarget: rulerDragTarget,
    dragStartPos: rulerDragStartPos,
    yToPrice,
  };

  const rulerPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: (evt) => evt.nativeEvent.locationY < CHART_HEIGHT - 65,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (evt) => evt.nativeEvent.locationY < CHART_HEIGHT - 65,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt) => {
        const rawX = evt.nativeEvent.locationX;
        const rawY = evt.nativeEvent.locationY;
        const touchX = Math.max(10, Math.min(360, rawX));
        const touchY = Math.max(25, Math.min(CHART_HEIGHT - 35, rawY));
        const touchPrice = rulerStateRef.current.yToPrice(touchY);

        const { point1, point2 } = rulerStateRef.current;

        // 1. Durum: Henüz sadece 1. nokta seçilmişse, bu dokunuş 2. noktadır
        if (point1 && !point2) {
          setRulerPoint2({ x: touchX, y: touchY, price: touchPrice });
          setRulerStep(2);
          setRulerDragTarget(null);
          return;
        }

        // 2. Durum: Her iki nokta da mevcut, tutamaçları sürükle veya en yakın noktayı güncelle
        if (point1 && point2) {
          const curP1X = point1.x;
          const curP1Y = point1.y;
          const curP2X = point2.x;
          const curP2Y = point2.y;

          const dist1 = Math.hypot(touchX - curP1X, touchY - curP1Y);
          const dist2 = Math.hypot(touchX - curP2X, touchY - curP2Y);

          // 1. Nokta tutamacı (38px geniş tutma alanı)
          if (dist1 < 38) {
            setRulerDragTarget('p1');
            return;
          }
          // 2. Nokta tutamacı (38px geniş tutma alanı)
          if (dist2 < 38) {
            setRulerDragTarget('p2');
            return;
          }

          // Kutu içi sürükleme (tüm ölçümü taşıma)
          const minX = Math.min(curP1X, curP2X);
          const maxX = Math.max(curP1X, curP2X);
          const minY = Math.min(curP1Y, curP2Y);
          const maxY = Math.max(curP1Y, curP2Y);

          if (touchX >= minX - 12 && touchX <= maxX + 12 && touchY >= minY - 12 && touchY <= maxY + 12) {
            setRulerDragTarget('box');
            setRulerDragStartPos({
              x: touchX,
              y: touchY,
              p1: { ...point1 },
              p2: { ...point2 },
            });
            return;
          }

          // Dışarıya basıldıysa en yakın noktayı taşı
          if (dist1 < dist2) {
            setRulerPoint1({ x: touchX, y: touchY, price: touchPrice });
            setRulerDragTarget('p1');
          } else {
            setRulerTrackingLive(false);
            setRulerPoint2({ x: touchX, y: touchY, price: touchPrice });
            setRulerDragTarget('p2');
          }
        } else {
          // İlk dokunuş: 1. Nokta belirlenir
          setRulerPoint1({ x: touchX, y: touchY, price: touchPrice });
          setRulerPoint2(null);
          setRulerStep(1);
        }
      },
      onPanResponderMove: (evt) => {
        const { dragTarget, dragStartPos } = rulerStateRef.current;
        if (!dragTarget) return;

        const rawX = evt.nativeEvent.locationX;
        const rawY = evt.nativeEvent.locationY;
        const touchX = Math.max(10, Math.min(360, rawX));
        const touchY = Math.max(25, Math.min(CHART_HEIGHT - 35, rawY));
        const touchPrice = rulerStateRef.current.yToPrice(touchY);

        if (dragTarget === 'p1') {
          setRulerPoint1({ x: touchX, y: touchY, price: touchPrice });
        } else if (dragTarget === 'p2') {
          setRulerTrackingLive(false);
          setRulerPoint2({ x: touchX, y: touchY, price: touchPrice });
        } else if (dragTarget === 'box' && dragStartPos) {
          const dx = touchX - dragStartPos.x;
          const dy = touchY - dragStartPos.y;

          const newP1X = Math.max(10, Math.min(350, dragStartPos.p1.x + dx));
          const newP1Y = Math.max(25, Math.min(CHART_HEIGHT - 35, dragStartPos.p1.y + dy));
          const newP2X = Math.max(10, Math.min(350, dragStartPos.p2.x + dx));
          const newP2Y = Math.max(25, Math.min(CHART_HEIGHT - 35, dragStartPos.p2.y + dy));

          setRulerPoint1({ x: newP1X, y: newP1Y, price: rulerStateRef.current.yToPrice(newP1Y) });
          setRulerPoint2({ x: newP2X, y: newP2Y, price: rulerStateRef.current.yToPrice(newP2Y) });
        }
      },
      onPanResponderRelease: () => {
        setRulerDragTarget(null);
        setRulerDragStartPos(null);
      },
      onPanResponderTerminate: () => {
        setRulerDragTarget(null);
        setRulerDragStartPos(null);
      },
    });
  }, []);

  useEffect(() => {
    fetchUsdTryRate();
    fetchGlobalMarketData().then(setGlobalMarket);

    fetchCurrentPrice(symbol).then((price) => {
      if (price) {
        setCurrentPrice(price);
        updateMarketPrice(symbol, price);
        if (!limitPrice) setLimitPrice(price.toString());
      }
    });

    fetch24hTicker(symbol).then((t) => {
      if (t) setTicker24h(t);
    });

    // 2. Canlı WebSocket Fiyat Akışı (mumun son tepe/dip seviyesini de canlı günceller)
    const unsubscribePrice = subscribeToLivePrice(symbol, (livePrice) => {
      setCurrentPrice(livePrice);
      updateMarketPrice(symbol, livePrice);
      setCandles((prev) => {
        if (!prev || prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.close === livePrice && last.high >= livePrice && last.low <= livePrice) return prev;
        const updatedLast: KlineCandle = {
          ...last,
          close: livePrice,
          high: Math.max(last.high, livePrice),
          low: Math.min(last.low, livePrice),
        };
        return [...prev.slice(0, -1), updatedLast];
      });
    });

    const unsubscribeDepth = subscribeToOrderBook(symbol, (depth) => {
      setOrderBook(depth);
    });

    return () => {
      unsubscribePrice();
      unsubscribeDepth();
    };
  }, [symbol]);

  useEffect(() => {
    fetchActiveSymbols().then((symbols) => {
      if (symbols && symbols.length > 0) {
        const dynamicPairs: CryptoPair[] = symbols.map((s) => ({
          symbol: s.symbol,
          name: `${s.baseAsset}/USDT`,
          baseAsset: s.baseAsset,
          defaultAmount: s.baseAsset === 'BTC' ? '0.05' : s.baseAsset === 'ETH' ? '0.5' : '1.0',
        }));
        setPairsList(dynamicPairs);
      }
    });
  }, []);

  const filteredPairs = useMemo(() => {
    const query = pairSearchQuery.trim().toUpperCase();
    if (!query) {
      return pairsList;
    }

    const startsWithList = pairsList.filter(
      (p) =>
        p.baseAsset.toUpperCase().startsWith(query) ||
        p.symbol.toUpperCase().startsWith(query)
    );

    const containsList = pairsList.filter(
      (p) =>
        !p.baseAsset.toUpperCase().startsWith(query) &&
        !p.symbol.toUpperCase().startsWith(query) &&
        (p.baseAsset.toUpperCase().includes(query) ||
          p.symbol.toUpperCase().includes(query) ||
          p.name.toUpperCase().includes(query))
    );

    startsWithList.sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));
    containsList.sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));

    return [...startsWithList, ...containsList];
  }, [pairsList, pairSearchQuery]);

  const handleSelectPair = (pair: CryptoPair) => {
    setSelectedPair(pair);
    setLimitPrice('');
    setPairSearchQuery('');
    setTpPrice('');
    setSlPrice('');
    setShowPairModal(false);
  };

  const currencySymbol = challengeCurrency === 'TRY' ? '₺' : '$';
  const usdRate = usdTryRate > 0 ? usdTryRate : 34.85;
  const challengeRate = challengeCurrency === 'TRY' ? usdRate : 1;
  const rate = challengeRate;

  // Emir Hesaplamaları (Marjin Esaslı)
  const executionPrice = orderType === 'LIMIT' && parseFloat(limitPrice) > 0 ? parseFloat(limitPrice) : currentPrice;
  const marginNum = parseFloat(marginInput || '0');
  const positionVolumeSelected = marginNum * leverage;
  const positionVolumeUsd = positionVolumeSelected / challengeRate;
  const coinQuantity = executionPrice > 0 ? positionVolumeUsd / executionPrice : 0;
  const estimatedFeeSelected = positionVolumeSelected * 0.0005;

  const usedMargin = (activeChallenge.positions || []).reduce((sum, p) => sum + p.margin, 0);
  const availableBalance = Math.max(0, (activeChallenge.balance ?? 100000) - usedMargin);
  const remainingBalanceUsd = Math.max(0, (availableBalance - marginNum) / challengeRate);

  const estLiquidation = calculateLiquidationPrice(
    executionPrice,
    leverage,
    side,
    marginMode,
    marginMode === 'CROSS' ? remainingBalanceUsd : 0,
    coinQuantity
  );

  const applyQuickTp = (percent: number) => {
    setSelectedTpPercent(percent);
    if (executionPrice <= 0) return;
    const factor = side === 'LONG' ? 1 + percent / 100 : 1 - percent / 100;
    setTpPrice(formatPricePrecision(executionPrice * factor));
  };

  const applyQuickSl = (percent: number) => {
    setSelectedSlPercent(percent);
    if (executionPrice <= 0) return;
    const factor = side === 'LONG' ? 1 - percent / 100 : 1 + percent / 100;
    setSlPrice(formatPricePrecision(executionPrice * factor));
  };

  const handleQuickPercent = (percent: number) => {
    if (availableBalance <= 0) return;
    const targetMargin = availableBalance * (percent / 100);
    setMarginInput(targetMargin >= 100 ? targetMargin.toFixed(0) : targetMargin.toFixed(2));
  };

  const handleOpenPosition = async () => {
    if (!marginNum || marginNum <= 0) {
      Alert.alert('Geçersiz Marjin', 'Lütfen geçerli bir işlem marjı girin.');
      return;
    }

    if (executionPrice <= 0) {
      Alert.alert('Fiyat Bekleniyor', 'Piyasa fiyatı yükleniyor, lütfen bekleyin.');
      return;
    }

    if (marginNum > availableBalance) {
      setShowInsufficientBalanceModal(true);
      return;
    }

    let parsedTp: number | undefined = undefined;
    let parsedSl: number | undefined = undefined;

    if (isTpSlEnabled) {
      if (tpPrice.trim()) {
        parsedTp = parseFloat(tpPrice.replace(',', '.'));
      } else if (selectedTpPercent !== null && selectedTpPercent > 0) {
        parsedTp = side === 'LONG'
          ? executionPrice * (1 + selectedTpPercent / 100)
          : executionPrice * (1 - selectedTpPercent / 100);
      }

      if (parsedTp !== undefined) {
        if (side === 'LONG' && parsedTp <= executionPrice) {
          Alert.alert('Hatalı TP', 'Long işlemde Kâr Al fiyatı giriş fiyatından büyük olmalıdır.');
          return;
        }
        if (side === 'SHORT' && parsedTp >= executionPrice) {
          Alert.alert('Hatalı TP', 'Short işlemde Kâr Al fiyatı giriş fiyatından küçük olmalıdır.');
          return;
        }
      }

      if (slPrice.trim()) {
        parsedSl = parseFloat(slPrice.replace(',', '.'));
      } else if (selectedSlPercent !== null && selectedSlPercent > 0) {
        parsedSl = side === 'LONG'
          ? executionPrice * (1 - selectedSlPercent / 100)
          : executionPrice * (1 + selectedSlPercent / 100);
      }

      if (parsedSl !== undefined) {
        if (side === 'LONG' && parsedSl >= executionPrice) {
          Alert.alert('Hatalı SL', 'Long işlemde Zarar Durdur fiyatı giriş fiyatından küçük olmalıdır.');
          return;
        }
        if (side === 'SHORT' && parsedSl <= executionPrice) {
          Alert.alert('Hatalı SL', 'Short işlemde Zarar Durdur fiyatı giriş fiyatından büyük olmalıdır.');
          return;
        }
      }
    }

    const success = await openChallengePosition({
      symbol,
      side,
      leverage,
      marginMode,
      entryPrice: executionPrice,
      amount: coinQuantity,
      liquidationPrice: estLiquidation,
      takeProfit: parsedTp,
      stopLoss: parsedSl,
    });

    if (success) {
      showOrderToast(symbol, side, leverage);
      setTpPrice('');
      setSlPrice('');
      setSelectedTpPercent(null);
      setSelectedSlPercent(null);
    } else {
      Alert.alert('Hata', 'Challenge pozisyonu açılamadı. Lütfen bakiyenizi kontrol edin.');
    }
  };

  const handleStartChallenge = () => {
    const amt = parseFloat(setupAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Geçersiz Bakiye', 'Lütfen geçerli bir başlangıç sermayesi girin.');
      return;
    }
    configureChallenge(amt, setupCurrency);
    setShowSetupModal(false);
    setChallengeStartedData({ amount: amt, currency: setupCurrency });
  };

  const openTpSlModal = (pos: any) => {
    setEditingPos(pos);
    setEditTpInput(pos.takeProfit ? pos.takeProfit.toString() : '');
    setEditSlInput(pos.stopLoss ? pos.stopLoss.toString() : '');
  };

  const handleSaveTpSl = () => {
    if (!editingPos) return;
    const parsedTp = editTpInput.trim() ? parseFloat(editTpInput.replace(',', '.')) : undefined;
    const parsedSl = editSlInput.trim() ? parseFloat(editSlInput.replace(',', '.')) : undefined;

    updateChallengePositionTPSL(editingPos.id, parsedTp, parsedSl);
    setEditingPos(null);
  };

  const handleConfirmClose = async () => {
    if (!closingTargetPos) return;
    await closeChallengePosition(closingTargetPos.id, closingTargetPos.currentPrice, 'MANUAL');
    setClosingTargetPos(null);
  };

  const tradingViewHtml = useMemo(() => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.5, maximum-scale=3.0, user-scalable=yes" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          html, body { background-color: #0b0e11; overflow: hidden; height: 100%; width: 100%; user-select: none; -webkit-user-select: none; }
          #tv-chart { height: 100%; width: 100%; }
        </style>
      </head>
      <body>
        <div id="tv-chart"></div>
        <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
        <script type="text/javascript">
          new TradingView.widget({
            "autosize": true,
            "symbol": "BINANCE:${symbol}",
            "interval": "${selectedInterval}",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "tr",
            "toolbar_bg": "#0b0e14",
            "enable_publishing": false,
            "hide_top_toolbar": true,
            "hide_legend": false,
            "hide_side_toolbar": true,
            "allow_symbol_change": false,
            "save_image": false,
            "withdateranges": false,
            "container_id": "tv-chart"
          });
        </script>
      </body>
    </html>
  `, [symbol, selectedInterval]);

  // Challenge İstatistikleri
  const netPnL = activeChallenge.balance - activeChallenge.initialBalance;
  const targetProgress = Math.max(0, Math.min((netPnL / (activeChallenge.profitTarget || 1)) * 100, 100));

  const totalOpenPositions = (activeChallenge.positions || []).length;
  const totalUnrealizedPnL = useMemo(() => {
    return (activeChallenge.positions || []).reduce((sum, pos) => {
      return sum + calculatePnL(pos.entryPrice, pos.currentPrice, pos.amount, pos.side) * challengeRate;
    }, 0);
  }, [activeChallenge.positions, challengeRate]);

  const totalEquity = activeChallenge.balance + totalUnrealizedPnL;

  const formatMoney = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.mainScrollView}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        scrollEnabled={!isChartInteracting && !isRulerActive}
      >
        {/* 1. ÜST TICKER & BAŞLIK BARI (Trade Challenge Simulation Header - Blue Theme) */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 2 }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeftGroup}>
              <TouchableOpacity
                style={styles.pairPickerBtn}
                onPress={() => setShowPairModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.pairIconBadge}>
                  <Ionicons name="swap-vertical" size={14} color="#60a5fa" />
                </View>
                <Text style={styles.pairPickerTitle}>{selectedPair.name}</Text>
                <View style={styles.challengeTag}>
                  <Text style={styles.challengeTagText}>CHALLENGE</Text>
                </View>
                <Ionicons name="chevron-down" size={14} color="#848e9c" />
              </TouchableOpacity>

              {/* SAĞ ÜSTTE: PARİTENİN SAĞINDA MOD SEÇİCİ */}
              <TouchableOpacity
                style={styles.modePickerBtn}
                onPress={() => setShowModeModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="trophy" size={12} color="#60a5fa" />
                <Text style={styles.modePickerBtnText}>Challenge Mod</Text>
                <Ionicons name="chevron-down" size={11} color="#60a5fa" />
              </TouchableOpacity>
            </View>

            <View style={styles.headerRightStats}>
              {/* CHALLENGE SIFIRLAMA BUTONU */}
              <TouchableOpacity
                style={styles.resetBtn}
                onPress={() => setShowResetConfirmModal(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="reload" size={15} color="#60a5fa" />
              </TouchableOpacity>
            </View>
          </View>

          {/* EN ÜST SATIRIN HEMEN ALTINDA: Toplam Tutar, Kullanılabilir Bakiye, Kilitli Para Birimi */}
          <View style={styles.balanceCurrencyBar}>
            <View style={styles.balanceBarCol}>
              <Text style={styles.balanceBarLabel}>Challenge Sermayesi</Text>
              <Text style={styles.balanceBarValue}>
                {formatMoney(totalEquity)}
              </Text>
            </View>

            <View style={styles.balanceBarCol}>
              <Text style={styles.balanceBarLabel}>Kullanılabilir Bakiye</Text>
              <Text style={[styles.balanceBarValue, { color: '#0ecb81' }]}>
                {formatMoney(availableBalance)}
              </Text>
            </View>

            <View style={styles.currencyToggleCol}>
              <Text style={styles.currencyToggleLabel}>Para Birimi</Text>
              <View style={styles.currencyLockedBadge}>
                <Ionicons name="lock-closed" size={11} color="#60a5fa" style={{ marginRight: 4 }} />
                <Text style={styles.currencyLockedText}>
                  {currencySymbol} {challengeCurrency} (Sabit)
                </Text>
              </View>
            </View>
          </View>

          {/* CHALLENGE 2X KATLAMA HEDEFİ İLERLEME ŞERİDİ */}
          <View style={styles.challengeProgressStrip}>
            <View style={styles.challengeProgressHeader}>
              <View style={styles.progressTitleGroup}>
                <Ionicons name="ribbon-outline" size={13} color="#60a5fa" />
                <Text style={styles.challengeProgressTitle}>
                  Katlama Hedefi (2x): +{currencySymbol}{activeChallenge.profitTarget.toLocaleString('tr-TR')} {challengeCurrency}
                </Text>
              </View>
              <Text style={[styles.challengePnLBadge, { color: netPnL >= 0 ? '#0ecb81' : '#f6465d' }]}>
                {netPnL >= 0 ? '+' : ''}{currencySymbol}{netPnL.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ({((netPnL / (activeChallenge.initialBalance || 1)) * 100).toFixed(1)}%)
              </Text>
            </View>
            <View style={styles.progressBarWrapper}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${targetProgress}%` }]} />
              </View>
              <Text style={styles.progressBarPercentText}>%{targetProgress.toFixed(1)} Tamamlandı</Text>
            </View>
          </View>

          {/* GLOBAL KRİPTO PİYASASI (COINMARKETCAP VERİLERİ) */}
          <View style={styles.globalMarketBar}>
            <View style={styles.globalMarketHeader}>
              <View style={styles.globalMarketTitleRow}>
                <Ionicons name="earth" size={12} color="#60a5fa" />
                <Text style={styles.globalMarketTitle}>Global Kripto Piyasası</Text>
              </View>
              <View style={styles.cmcBadge}>
                <Text style={styles.cmcBadgeText}>CoinMarketCap</Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricsStrip}
            >
              <View style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <Ionicons name="pie-chart-outline" size={12} color="#60a5fa" />
                  <Text style={styles.metricCardTitle}>Toplam Piyasa Değeri</Text>
                </View>
                <Text style={styles.metricCardValue}>
                  {formatCompactCurrency(globalMarket.totalMarketCapUsd, challengeCurrency, usdRate)}
                </Text>
                <Text
                  style={[
                    styles.metricCardSub,
                    { color: globalMarket.totalMarketCapChange24h >= 0 ? '#0ecb81' : '#f6465d' },
                  ]}
                >
                  {globalMarket.totalMarketCapChange24h >= 0 ? '+' : ''}
                  {globalMarket.totalMarketCapChange24h.toFixed(2)}% (24s)
                </Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <Ionicons name="bar-chart-outline" size={12} color="#0ecb81" />
                  <Text style={styles.metricCardTitle}>24s Toplam Hacim</Text>
                </View>
                <Text style={styles.metricCardValue}>
                  {formatCompactCurrency(globalMarket.totalVolume24hUsd, challengeCurrency, usdRate)}
                </Text>
                <Text
                  style={[
                    styles.metricCardSub,
                    { color: globalMarket.totalVolumeChange24h >= 0 ? '#0ecb81' : '#f6465d' },
                  ]}
                >
                  {globalMarket.totalVolumeChange24h >= 0 ? '+' : ''}
                  {globalMarket.totalVolumeChange24h.toFixed(2)}% (24s)
                </Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <Ionicons name="logo-bitcoin" size={12} color="#f7931a" />
                  <Text style={styles.metricCardTitle}>BTC Hakimiyeti</Text>
                </View>
                <Text style={[styles.metricCardValue, { color: '#f7931a' }]}>
                  %{globalMarket.btcDominance.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.metricCardSub,
                    { color: globalMarket.btcDominanceChange24h >= 0 ? '#0ecb81' : '#f6465d' },
                  ]}
                >
                  {globalMarket.btcDominanceChange24h >= 0 ? '+' : ''}
                  {globalMarket.btcDominanceChange24h.toFixed(2)}%
                </Text>
              </View>

              {/* ETH Hakimiyeti */}
              <View style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <Ionicons name="diamond-outline" size={12} color="#627eea" />
                  <Text style={styles.metricCardTitle}>ETH Hakimiyeti</Text>
                </View>
                <Text style={[styles.metricCardValue, { color: '#627eea' }]}>
                  %{globalMarket.ethDominance.toFixed(1)}
                </Text>
                <Text
                  style={[
                    styles.metricCardSub,
                    { color: globalMarket.ethDominanceChange24h >= 0 ? '#0ecb81' : '#f6465d' },
                  ]}
                >
                  {globalMarket.ethDominanceChange24h >= 0 ? '+' : ''}
                  {globalMarket.ethDominanceChange24h.toFixed(2)}% (24s)
                </Text>
              </View>

              <View style={styles.metricCard}>
                <View style={styles.metricCardHeader}>
                  <Ionicons name="speedometer-outline" size={12} color="#60a5fa" />
                  <Text style={styles.metricCardTitle}>Korku & Açgözlülük</Text>
                </View>
                <Text style={[styles.metricCardValue, { color: globalMarket.fearAndGreedValue >= 50 ? '#0ecb81' : '#f6465d' }]}>
                  {globalMarket.fearAndGreedValue}/100
                </Text>
                <Text style={styles.metricCardSub}>
                  {globalMarket.fearAndGreedClassification}
                </Text>
              </View>
            </ScrollView>
          </View>

          {/* 24h Ticker Strip */}
          <View style={styles.tickerStrip}>
            <View>
              <Text
                style={[
                  styles.livePriceText,
                  { color: (ticker24h?.priceChangePercent ?? 0) >= 0 ? '#0ecb81' : '#f6465d' },
                ]}
              >
                {currentPrice > 0 ? `$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '---'}
              </Text>
              <Text
                style={[
                  styles.changePercentText,
                  { color: (ticker24h?.priceChangePercent ?? 0) >= 0 ? '#0ecb81' : '#f6465d' },
                ]}
              >
                {(ticker24h?.priceChangePercent ?? 0) >= 0 ? '+' : ''}
                {ticker24h?.priceChangePercent?.toFixed(2) ?? '0.00'}%
              </Text>
            </View>

            <View style={styles.tickerMetaItem}>
              <Text style={styles.tickerMetaLabel}>24s En Yüksek</Text>
              <Text style={styles.tickerMetaValue}>${ticker24h?.highPrice?.toLocaleString('en-US') ?? '---'}</Text>
            </View>
            <View style={styles.tickerMetaItem}>
              <Text style={styles.tickerMetaLabel}>24s En Düşük</Text>
              <Text style={styles.tickerMetaValue}>${ticker24h?.lowPrice?.toLocaleString('en-US') ?? '---'}</Text>
            </View>
            <View style={styles.tickerMetaItem}>
              <Text style={styles.tickerMetaLabel}>24s Hacim(USDT)</Text>
              <Text style={styles.tickerMetaValue}>
                {ticker24h?.volume ? `${(ticker24h.volume / 1000).toFixed(1)}K` : '---'}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. GÖRÜNÜM SEÇİCİ */}
        <View style={styles.viewSegmentRow}>
          <TouchableOpacity
            style={[styles.viewSegmentBtn, activeViewTab === 'CHART' && styles.viewSegmentBtnActive]}
            onPress={() => setActiveViewTab('CHART')}
          >
            <Ionicons name="bar-chart" size={14} color={activeViewTab === 'CHART' ? '#60a5fa' : '#848e9c'} />
            <Text style={[styles.viewSegmentText, activeViewTab === 'CHART' && styles.viewSegmentTextActive]}>
              Grafik
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewSegmentBtn, activeViewTab === 'ORDERBOOK' && styles.viewSegmentBtnActive]}
            onPress={() => setActiveViewTab('ORDERBOOK')}
          >
            <Ionicons name="reorder-four" size={14} color={activeViewTab === 'ORDERBOOK' ? '#60a5fa' : '#848e9c'} />
            <Text style={[styles.viewSegmentText, activeViewTab === 'ORDERBOOK' && styles.viewSegmentTextActive]}>
              Emir Defteri
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. GRAFİK VE EMİR DEFTERİ ALANI */}
        <View style={styles.chartAndBookContainer}>
          {activeViewTab === 'CHART' && (
            <View style={styles.chartWrapper}>
              {/* Zaman Aralığı Çubuğu & Cetvel Butonu */}
              <View style={styles.timeframeBar}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.timeframeScroll}
                  contentContainerStyle={styles.timeframeScrollList}
                >
                  {TIMEFRAMES.map((tf) => (
                    <TouchableOpacity
                      key={tf.value}
                      style={[styles.tfBtn, selectedInterval === tf.value && styles.tfBtnActive]}
                      onPress={() => setSelectedInterval(tf.value)}
                    >
                      <Text style={[styles.tfBtnText, selectedInterval === tf.value && styles.tfBtnTextActive]}>
                        {tf.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Sağ Araçlar: Giriş & Cetvel */}
                <View style={styles.chartToolsGroup}>
                  {currentOpenPosition && (
                    <TouchableOpacity
                      style={[
                        styles.rulerToggleBtn,
                        isEntryGuideActive && { backgroundColor: '#f0b90b', borderColor: '#f0b90b' },
                      ]}
                      onPress={() => {
                        const next = !isEntryGuideActive;
                        setIsEntryGuideActive(next);
                        if (next) {
                          setIsRulerActive(false);
                          setRulerStep(0);
                          setRulerPoint1(null);
                          setRulerPoint2(null);
                        }
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isEntryGuideActive ? 'flag' : 'flag-outline'}
                        size={12}
                        color={isEntryGuideActive ? '#0b0e11' : '#f0b90b'}
                      />
                      <Text style={[styles.rulerToggleText, isEntryGuideActive ? { color: '#0b0e11' } : { color: '#f0b90b' }]}>
                        {isEntryGuideActive ? 'Giriş Açık' : 'Giriş'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.rulerToggleBtn, isRulerActive && styles.rulerToggleBtnActive]}
                    onPress={() => {
                      const next = !isRulerActive;
                      setIsRulerActive(next);
                      if (next) {
                        setIsEntryGuideActive(false);
                        const currentOrFall = currentPrice > 0 ? currentPrice : visibleHigh;
                        const p1PriceVal = currentOrFall * 0.985;
                        const p2PriceVal = currentOrFall;
                        const p1Y = priceToY(p1PriceVal);
                        const p2Y = priceToY(p2PriceVal);
                        setRulerPoint1({ x: 70, y: p1Y, price: p1PriceVal });
                        setRulerPoint2({ x: 260, y: p2Y, price: p2PriceVal });
                        setRulerStep(2);
                        setRulerTrackingLive(false);
                        setRulerDragTarget(null);
                        const binanceInterval = INTERVAL_MAP[selectedInterval] || '15m';
                        fetchKlines(symbol, binanceInterval, 70).then((data) => {
                          if (data && data.length > 0) setCandles(data);
                        });
                      } else {
                        setRulerStep(0);
                        setRulerPoint1(null);
                        setRulerPoint2(null);
                        setRulerTrackingLive(false);
                        setRulerDragTarget(null);
                      }
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={isRulerActive ? 'contract' : 'contract-outline'} size={12} color={isRulerActive ? '#0b0e11' : '#60a5fa'} />
                    <Text style={[styles.rulerToggleText, isRulerActive && styles.rulerToggleTextActive]}>
                      {isRulerActive ? 'Cetvel Açık' : 'Cetvel'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* TradingView WebView */}
              <View
                style={styles.chartContainer}
                onTouchStart={() => {
                  if (!isRulerActive) {
                    requestAnimationFrame(() => setIsChartInteracting(true));
                  }
                }}
                onTouchEnd={() => requestAnimationFrame(() => setIsChartInteracting(false))}
                onTouchCancel={() => requestAnimationFrame(() => setIsChartInteracting(false))}
              >
                <WebView
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: tradingViewHtml }}
                  style={styles.webview}
                  scrollEnabled={!isRulerActive}
                  pointerEvents={isRulerActive ? 'none' : 'auto'}
                  nestedScrollEnabled={true}
                  overScrollMode="never"
                  scalesPageToFit={true}
                />

                {/* AÇIK CHALLENGE POZİSYON SL ÇİZGİSİ (Yeşil kesik kesik TP çizgisi tamamen kaldırıldı) */}
                {(activeChallenge.positions || [])
                  .filter((pos) => pos.symbol === symbol)
                  .map((pos) => {
                    const slY = pos.stopLoss ? priceToY(pos.stopLoss) : null;
                    return (
                      <View
                        key={`ch-pos-overlay-${pos.id}`}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      >
                        {/* SL (Zarar Durdur) Çizgisi */}
                        {slY !== null && slY >= 0 && slY <= CHART_HEIGHT && (
                          <View style={[styles.chartEntryRow, { top: slY - 9 }]}>
                            <View style={[styles.chartTpSlLeftBadge, { backgroundColor: '#f6465d' }]}>
                              <Text style={styles.chartTpSlBadgeText}>SL</Text>
                            </View>
                            <View style={[styles.chartTpSlLine, { borderColor: '#f6465d' }]} />
                            <View style={[styles.chartEntryRightBadge, { backgroundColor: '#f6465d' }]}>
                              <Text style={styles.chartTpSlRightBadgeText}>
                                {formatSmartPrice(pos.stopLoss!)}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}

                {/* GİRİŞ ÇİZGİSİ (Sadece bu coinde açık pozisyon varsa gösterilir) */}
                {isEntryGuideActive && currentOpenPosition && effectiveEntryPrice > 0 && (
                  <View
                    style={[
                      styles.chartEntryRow,
                      {
                        top: Math.max(15, Math.min(CHART_HEIGHT - 35, entryGuideY)) - 10,
                        zIndex: 45,
                        elevation: 45,
                      },
                    ]}
                    pointerEvents="box-none"
                  >
                    {/* Sol Rozet: ▲ LONG Giriş veya ▼ SHORT Giriş */}
                    <View
                      style={[
                        styles.chartEntryLeftBadge,
                        {
                          backgroundColor: '#f0b90b',
                        },
                      ]}
                    >
                      <Text style={[styles.chartEntryLeftBadgeText, { color: '#0b0e11' }]}>
                        {currentOpenPosition.side === 'SHORT' ? '▼ SHORT Giriş' : '▲ LONG Giriş'}
                      </Text>
                    </View>

                    {/* Yatay Sabit Giriş Çizgisi (Altın Sarısı - Kırmızı veya Yeşil Değil) */}
                    <View
                      style={[
                        styles.chartEntryLine,
                        {
                          backgroundColor: '#f0b90b',
                          height: 2,
                        },
                      ]}
                    />

                    {/* Sağ Rozet: Fiyat ve Kapatma Butonu */}
                    <View
                      style={[
                        styles.chartEntryRightBadge,
                        {
                          backgroundColor: '#f0b90b',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                        },
                      ]}
                    >
                      <Text style={[styles.chartEntryRightBadgeText, { color: '#0b0e11' }]}>
                        {formatSmartPrice(effectiveEntryPrice)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsEntryGuideActive(false)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={14} color="#0b0e11" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Grafik Üzeri Etkileşimli Cetvel (TradingView Stili: 2 Yer Seçilince Aktif Tutamaç ve Yüzdelik Bilgi) */}
                {isRulerActive && (
                  <View
                    style={styles.rulerOverlay}
                    collapsable={false}
                    {...rulerPanResponder.panHandlers}
                  >
                    {/* Üst Yardımcı & Kontrol Başlığı */}
                    <View style={styles.rulerTopControls} pointerEvents="box-none">
                      <View style={styles.rulerHelpPill}>
                        <Ionicons name="sparkles" size={12} color="#60a5fa" />
                        <Text style={styles.rulerHelpText}>
                          {rulerStep === 0
                            ? '1. Nokta için grafiğe dokunun'
                            : rulerStep === 1
                            ? '✓ 1. Nokta seçildi. Lütfen 2. Noktayı seçin'
                            : 'Tutamaçları veya kutuyu sürükleyebilirsiniz'}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.rulerCloseHeaderBtn}
                        onPress={() => {
                          setIsRulerActive(false);
                          setRulerStep(0);
                          setRulerPoint1(null);
                          setRulerPoint2(null);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close" size={14} color="#eaecef" />
                      </TouchableOpacity>
                    </View>

                    {/* SADECE 1. NOKTA SEÇİLDİĞİNDE: Yalnızca Nokta 1 İşareti ve Çizgisi Gösterilir */}
                    {rulerStep === 1 && rulerPoint1 && (
                      <View style={[styles.rulerGuideLine, { top: displayP1Y }]} pointerEvents="none">
                        <View style={[styles.rulerLineSolid, { backgroundColor: '#f0b90b' }]} />
                        <View style={[styles.rulerTag, styles.rulerTagP1]}>
                          <Text style={styles.rulerTagLabel}>1. Nokta</Text>
                          <Text style={styles.rulerTagPrice}>${formatSmartPrice(p1Price)}</Text>
                        </View>
                      </View>
                    )}

                    {/* KULLANICI 2 YER SEÇİNCE (rulerStep === 2): TUTAMAÇLAR KULLANILSIN, YÜZDELİK BİLGİ VERİLSİN VE SÜRÜKLENEBİLİR OLSUN */}
                    {rulerStep === 2 && rulerPoint1 && rulerPoint2 && (
                      <>
                        {/* 1. TradingView 2D Ölçüm Kutusu */}
                        <View
                          style={[
                            styles.rulerMeasureBox2D,
                            {
                              top: Math.min(displayP1Y, displayP2Y),
                              left: Math.min(displayP1X, displayP2X),
                              width: Math.max(20, Math.abs(displayP2X - displayP1X)),
                              height: Math.max(2, Math.abs(displayP2Y - displayP1Y)),
                              backgroundColor: rulerDiff >= 0
                                ? 'rgba(59, 130, 246, 0.12)'
                                : 'rgba(246, 70, 93, 0.12)',
                              borderColor: rulerDiff >= 0
                                ? 'rgba(59, 130, 246, 0.5)'
                                : 'rgba(246, 70, 93, 0.5)',
                            },
                          ]}
                          pointerEvents="none"
                        />

                        {/* 2. Yatay Kılavuz Çizgisi: Nokta 1 (Sarı/Altın düz çizgi) */}
                        <View
                          style={[styles.rulerGuideLine, { top: displayP1Y }]}
                          pointerEvents="none"
                        >
                          <View style={[styles.rulerLineSolid, { backgroundColor: '#f0b90b' }]} />
                          <View style={[styles.rulerTag, styles.rulerTagP1]}>
                            <Text style={styles.rulerTagLabel}>Nokta 1</Text>
                            <Text style={styles.rulerTagPrice}>${formatSmartPrice(p1Price)}</Text>
                          </View>
                        </View>

                        {/* 3. Yatay Kılavuz Çizgisi: Nokta 2 (Mavi düz çizgi) */}
                        <View
                          style={[styles.rulerGuideLine, { top: displayP2Y }]}
                          pointerEvents="none"
                        >
                          <View
                            style={[
                              styles.rulerLineSolid,
                              { backgroundColor: rulerTrackingLive ? (rulerDiff >= 0 ? '#3b82f6' : '#f6465d') : '#3b82f6' },
                            ]}
                          />
                          <View
                            style={[
                              styles.rulerTag,
                              rulerTrackingLive
                                ? (rulerDiff >= 0 ? styles.rulerTagLiveUp : styles.rulerTagLiveDown)
                                : styles.rulerTagP2,
                            ]}
                          >
                            <Text style={styles.rulerTagLabel}>
                              {rulerTrackingLive ? '⚡ Canlı Fiyat' : 'Nokta 2'}
                            </Text>
                            <Text style={styles.rulerTagPrice}>${formatSmartPrice(p2Price)}</Text>
                          </View>
                        </View>

                        {/* 4. Sürüklenebilir Tutamaç 1 (Handle P1) */}
                        <View
                          style={[
                            styles.rulerHandleCircle,
                            { left: displayP1X - 10, top: displayP1Y - 10, borderColor: '#f0b90b' },
                          ]}
                          pointerEvents="none"
                        >
                          <View style={[styles.rulerHandleInnerDot, { backgroundColor: '#f0b90b' }]} />
                        </View>

                        {/* 5. Sürüklenebilir Tutamaç 2 (Handle P2) */}
                        <View
                          style={[
                            styles.rulerHandleCircle,
                            {
                              left: displayP2X - 10,
                              top: displayP2Y - 10,
                              borderColor: rulerTrackingLive ? (rulerDiff >= 0 ? '#3b82f6' : '#f6465d') : '#3b82f6',
                            },
                          ]}
                          pointerEvents="none"
                        >
                          <View
                            style={[
                              styles.rulerHandleInnerDot,
                              { backgroundColor: rulerTrackingLive ? (rulerDiff >= 0 ? '#3b82f6' : '#f6465d') : '#3b82f6' },
                            ]}
                          />
                        </View>

                        {/* 6. TradingView Bilgi Kartı (Grafiğin alt kısmına sabitlenmiş geniş ve şık panel) */}
                        <View
                          style={[
                            styles.rulerTvInfoCard,
                            {
                              borderColor: rulerDiff >= 0 ? '#0ecb81' : '#f6465d',
                            },
                          ]}
                          pointerEvents="box-none"
                        >
                          <View style={styles.rulerTvCardHeader}>
                            <View style={styles.rulerTvHeaderLeft}>
                              <Ionicons
                                name={rulerDiff >= 0 ? 'arrow-up-circle' : 'arrow-down-circle'}
                                size={15}
                                color={rulerDiff >= 0 ? '#0ecb81' : '#f6465d'}
                              />
                              <Text
                                style={[
                                  styles.rulerTvPercentText,
                                  { color: rulerDiff >= 0 ? '#0ecb81' : '#f6465d' },
                                ]}
                              >
                                {rulerDiff >= 0 ? '+' : ''}{rulerPercent.toFixed(2)}%
                              </Text>
                              <Text style={styles.rulerTvPriceDiffText}>
                                ({rulerDiff >= 0 ? '+' : '-'}${formatSmartPrice(Math.abs(rulerDiff))})
                              </Text>
                            </View>

                            <View style={styles.rulerTvHeaderRight}>
                              <Text style={styles.rulerTvMetaText}>
                                {rulerBarCount} Bar • {rulerDurationText}
                              </Text>
                              {rulerTrackingLive && (
                                <View style={styles.rulerTvLiveBadge}>
                                  <View style={styles.liveIndicatorDot} />
                                  <Text style={styles.rulerTvLiveText}>Canlı</Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* İki Noktanın Kesin Fiyat Değerleri */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 11, color: '#848e9c' }}>
                              Nokta 1: <Text style={{ color: '#f0b90b', fontWeight: 'bold' }}>${formatSmartPrice(p1Price)}</Text>
                            </Text>
                            <Ionicons name="arrow-forward" size={11} color="#848e9c" />
                            <Text style={{ fontSize: 11, color: '#848e9c' }}>
                              {rulerTrackingLive ? 'Canlı: ' : 'Nokta 2: '}<Text style={{ color: '#3b82f6', fontWeight: 'bold' }}>${formatSmartPrice(p2Price)}</Text>
                            </Text>
                          </View>

                          <View style={styles.rulerTvCardActionsRow}>
                            <TouchableOpacity
                              style={styles.rulerTvActionBtn}
                              onPress={() => setRulerTrackingLive(!rulerTrackingLive)}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={rulerTrackingLive ? 'flash' : 'flash-outline'}
                                size={11}
                                color={rulerTrackingLive ? '#60a5fa' : '#848e9c'}
                              />
                              <Text style={[styles.rulerTvActionBtnText, rulerTrackingLive && { color: '#60a5fa' }]}>
                                {rulerTrackingLive ? 'Canlı Takip' : 'Sabit'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.rulerTvActionBtn}
                              onPress={() => {
                                if (rulerPoint1 && rulerPoint2) {
                                  const temp = { ...rulerPoint1 };
                                  setRulerPoint1({ ...rulerPoint2 });
                                  setRulerPoint2(temp);
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="swap-vertical" size={11} color="#848e9c" />
                              <Text style={styles.rulerTvActionBtnText}>Ters Çevir</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.rulerTvActionBtn}
                              onPress={() => {
                                setRulerStep(0);
                                setRulerPoint1(null);
                                setRulerPoint2(null);
                                setRulerTrackingLive(false);
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="refresh" size={11} color="#848e9c" />
                              <Text style={styles.rulerTvActionBtnText}>Yeniden</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </>
                    )}
                  </View>
                )}


              </View>
            </View>
          )}

          {/* Emir Defteri (Order Book) */}
          {activeViewTab === 'ORDERBOOK' && (
            <View style={[styles.orderBookWrapper, { flex: 1, minHeight: 380 }]}>
              <View style={styles.orderBookHeader}>
                <Text style={styles.obHeadText}>Fiyat (USDT)</Text>
                <Text style={[styles.obHeadText, { textAlign: 'right' }]}>Miktar ({selectedPair.baseAsset})</Text>
              </View>

              {/* Asks (Kırmızı - Satış) */}
              <View style={styles.obList}>
                {orderBook.asks.slice(0, 8).reverse().map((ask, idx) => (
                  <TouchableOpacity
                    key={`ask-${idx}`}
                    style={styles.obRow}
                    onPress={() => setLimitPrice(ask.price.toFixed(2))}
                  >
                    <View
                      style={[
                        styles.obDepthBarAsk,
                        { width: `${Math.min(100, (ask.amount / 5) * 100)}%` },
                      ]}
                    />
                    <Text style={styles.obPriceAsk}>{ask.price.toFixed(2)}</Text>
                    <Text style={styles.obAmount}>{ask.amount.toFixed(3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Anlık Piyasa Fiyatı Ayracı */}
              <View style={styles.obMidPriceRow}>
                <Text
                  style={[
                    styles.obMidPriceText,
                    { color: (ticker24h?.priceChangePercent ?? 0) >= 0 ? '#0ecb81' : '#f6465d' },
                  ]}
                >
                  ${currentPrice.toFixed(2)}
                </Text>
                <Ionicons
                  name={(ticker24h?.priceChangePercent ?? 0) >= 0 ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={(ticker24h?.priceChangePercent ?? 0) >= 0 ? '#0ecb81' : '#f6465d'}
                />
              </View>

              {/* Bids (Yeşil - Alış) */}
              <View style={styles.obList}>
                {orderBook.bids.slice(0, 8).map((bid, idx) => (
                  <TouchableOpacity
                    key={`bid-${idx}`}
                    style={styles.obRow}
                    onPress={() => setLimitPrice(bid.price.toFixed(2))}
                  >
                    <View
                      style={[
                        styles.obDepthBarBid,
                        { width: `${Math.min(100, (bid.amount / 5) * 100)}%` },
                      ]}
                    />
                    <Text style={styles.obPriceBid}>{bid.price.toFixed(2)}</Text>
                    <Text style={styles.obAmount}>{bid.amount.toFixed(3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 4. EMİR FORMU */}
        <View style={styles.orderFormCard}>
          {/* Long / Short Yön Butonları */}
          <View style={styles.sideToggleRow}>
            <TouchableOpacity
              style={[styles.sideBtn, side === 'LONG' ? styles.sideBtnLongActive : styles.sideBtnInactive]}
              onPress={() => setSide('LONG')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={14} color={side === 'LONG' ? '#ffffff' : '#848e9c'} style={{ marginRight: 4 }} />
              <Text style={[styles.sideBtnText, side === 'LONG' && styles.sideBtnTextActive]}>
                Al / Long
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sideBtn, side === 'SHORT' ? styles.sideBtnShortActive : styles.sideBtnInactive]}
              onPress={() => setSide('SHORT')}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-down" size={14} color={side === 'SHORT' ? '#ffffff' : '#848e9c'} style={{ marginRight: 4 }} />
              <Text style={[styles.sideBtnText, side === 'SHORT' && styles.sideBtnTextActive]}>
                Sat / Short
              </Text>
            </TouchableOpacity>
          </View>

          {/* Emir Türü & Kaldıraç & Marjin Modu Seçimi */}
          <View style={styles.typeLeverageRow}>
            <View style={styles.orderTypeTabs}>
              <TouchableOpacity
                style={[styles.orderTypeTab, orderType === 'MARKET' && styles.orderTypeTabActive]}
                onPress={() => setOrderType('MARKET')}
              >
                <Text style={[styles.orderTypeText, orderType === 'MARKET' && styles.orderTypeTextActive]}>Piyasa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orderTypeTab, orderType === 'LIMIT' && styles.orderTypeTabActive]}
                onPress={() => {
                  setOrderType('LIMIT');
                  if (!limitPrice) setLimitPrice(currentPrice.toFixed(2));
                }}
              >
                <Text style={[styles.orderTypeText, orderType === 'LIMIT' && styles.orderTypeTextActive]}>Limit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.leverageModeGroup}>
              <TouchableOpacity
                style={styles.marginModeBtn}
                onPress={() => setMarginMode(marginMode === 'CROSS' ? 'ISOLATED' : 'CROSS')}
              >
                <Text style={styles.marginModeText}>{marginMode === 'CROSS' ? 'Çapraz' : 'İzole'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.leverageBtn}
                onPress={() => {
                  setTempLeverage(leverage);
                  setShowLeverageModal(true);
                }}
              >
                <Text style={styles.leverageBtnText}>{leverage}x</Text>
                <Ionicons name="chevron-down" size={12} color="#60a5fa" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Limit Fiyatı Girişi */}
          {orderType === 'LIMIT' && (
            <View style={styles.inputWrapper}>
              <View style={styles.inputHeaderRow}>
                <Text style={styles.inputLabel}>Limit Fiyatı (USDT)</Text>
                <TouchableOpacity onPress={() => setLimitPrice(currentPrice.toString())}>
                  <Text style={styles.inputActionText}>Son Fiyat</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={limitPrice}
                onChangeText={setLimitPrice}
                placeholder={currentPrice.toString()}
                placeholderTextColor="#5e6673"
              />
            </View>
          )}

          {/* İşlem Marjı Girişi (TRY veya USD cinsinden) */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputHeaderRow}>
              <Text style={styles.inputLabel}>İşlem Marjı (Teminat)</Text>
              <Text style={styles.inputSubLabel}>
                ~{coinQuantity >= 1 ? coinQuantity.toFixed(2) : coinQuantity.toFixed(4)} {selectedPair.baseAsset}
              </Text>
            </View>
            <View style={styles.marginInputBox}>
              <Text style={styles.marginInputPrefix}>{currencySymbol}</Text>
              <TextInput
                style={styles.marginTextInput}
                keyboardType="numeric"
                value={marginInput}
                onChangeText={setMarginInput}
                placeholder="1000"
                placeholderTextColor="#5e6673"
              />
              <Text style={styles.marginInputSuffix}>{challengeCurrency}</Text>
            </View>
          </View>

          {/* Hızlı Yüzde Butonları (%25, %50, %75, %100) */}
          <View style={styles.quickPercentRow}>
            {[25, 50, 75, 100].map((pct) => (
              <TouchableOpacity
                key={pct}
                style={styles.quickPercentBtn}
                onPress={() => handleQuickPercent(pct)}
              >
                <Text style={styles.quickPercentText}>%{pct}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* TP / SL (Kâr Al & Zarar Durdur) Etkinleştir Kutucuğu */}
          <TouchableOpacity
            style={styles.tpSlToggleBox}
            onPress={() => setIsTpSlEnabled(!isTpSlEnabled)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isTpSlEnabled ? 'checkbox' : 'square-outline'}
              size={18}
              color={isTpSlEnabled ? '#60a5fa' : '#848e9c'}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tpSlToggleTitle, isTpSlEnabled && { color: '#eaecef' }]}>
                TP / SL (Kar Al & Zarar Durdur) Etkinleştir
              </Text>
              <Text style={styles.tpSlToggleSub}>Otomatik hedef ve stop limit emirleri bağlayın</Text>
            </View>
            <Ionicons
              name={isTpSlEnabled ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#848e9c"
            />
          </TouchableOpacity>

          {/* Genişletilmiş TP / SL Form Alanı */}
          {isTpSlEnabled && (
            <View style={styles.tpSlExpandedContainer}>
              <View style={styles.tpSlInputGroup}>
                <View style={styles.tpSlInputHeader}>
                  <Text style={[styles.tpSlInputLabel, { color: '#0ecb81' }]}>Kâr Al (TP) Fiyatı</Text>
                  <View style={styles.quickPillsRow}>
                    {[1, 2, 3, 5, 10].map((pct) => (
                      <TouchableOpacity
                        key={`tp-${pct}`}
                        style={styles.quickPillBtn}
                        onPress={() => applyQuickTp(pct)}
                      >
                        <Text style={styles.quickPillText}>+%{pct}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  value={tpPrice}
                  onChangeText={setTpPrice}
                  placeholder={`Örn: ${(executionPrice * 1.05).toFixed(2)}`}
                  placeholderTextColor="#5e6673"
                />
              </View>

              <View style={styles.tpSlInputGroup}>
                <View style={styles.tpSlInputHeader}>
                  <Text style={[styles.tpSlInputLabel, { color: '#f6465d' }]}>Zarar Durdur (SL) Fiyatı</Text>
                  <View style={styles.quickPillsRow}>
                    {[1, 2, 3, 5, 10].map((pct) => (
                      <TouchableOpacity
                        key={`sl-${pct}`}
                        style={styles.quickPillBtn}
                        onPress={() => applyQuickSl(pct)}
                      >
                        <Text style={styles.quickPillText}>-%{pct}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <TextInput
                  style={styles.formInput}
                  keyboardType="numeric"
                  value={slPrice}
                  onChangeText={setSlPrice}
                  placeholder={`Örn: ${(executionPrice * 0.95).toFixed(2)}`}
                  placeholderTextColor="#5e6673"
                />
              </View>
            </View>
          )}

          {/* Maliyet ve Pozisyon Detay Özeti */}
          <View style={styles.costInfoCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Kullanılabilir Challenge Marjini:</Text>
              <Text style={styles.costValue}>{currencySymbol}{availableBalance.toFixed(2)} {challengeCurrency}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Gereken Teminat:</Text>
              <Text style={[styles.costValue, { color: '#eaecef' }]}>{currencySymbol}{marginNum.toFixed(2)} {challengeCurrency}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Pozisyon Hacmi:</Text>
              <Text style={styles.costValue}>{currencySymbol}{positionVolumeSelected.toFixed(2)} {challengeCurrency}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Tahmini Likidasyon:</Text>
              <Text style={[styles.costValue, { color: '#f6465d' }]}>
                {estLiquidation === 0 ? '-- (Risk Yok)' : `$${estLiquidation.toFixed(2)}`}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Tahmini Komisyon:</Text>
              <Text style={[styles.costValue, { color: '#848e9c' }]}>
                {currencySymbol}{estimatedFeeSelected.toFixed(2)} {challengeCurrency}
              </Text>
            </View>
          </View>

          {/* Ana İşlem Açma Butonu */}
          <TouchableOpacity
            style={[styles.mainOrderBtn, side === 'LONG' ? styles.mainOrderBtnLong : styles.mainOrderBtnShort]}
            onPress={handleOpenPosition}
            activeOpacity={0.85}
          >
            <Text style={styles.mainOrderBtnText}>
              {selectedPair.symbol} {side === 'LONG' ? 'LONG AÇ' : 'SHORT AÇ'} ({leverage}x {marginMode === 'ISOLATED' ? 'İZOLE' : 'ÇAPRAZ'})
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* İŞLEM AÇILDI TOAST BİLDİRİMİ (3 Saniyelik Mavi Animasyonlu Kutu) */}
      {orderToast && (
        <Animated.View
          style={[
            styles.orderToastContainer,
            {
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-60, 0],
                  }),
                },
              ],
              opacity: toastAnim,
            },
          ]}
        >
          <View style={styles.orderToastContent}>
            <View style={styles.orderToastIconCircle}>
              <Ionicons name="trophy" size={20} color="#60a5fa" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.orderToastTitleRow}>
                <Text style={styles.orderToastTitle}>Challenge Emri Açıldı 🏆</Text>
                <View style={[styles.toastSideBadge, orderToast.side === 'LONG' ? styles.bgLongTag : styles.bgShortTag]}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: orderToast.side === 'LONG' ? '#0ecb81' : '#f6465d' }}>
                    {orderToast.side} {orderToast.leverage}x
                  </Text>
                </View>
              </View>
              <Text style={styles.orderToastDesc}>
                {orderToast.symbol} pozisyonunuz Trade Challenge portföyüne eklendi.
              </Text>
            </View>
            <TouchableOpacity onPress={dismissToast} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#848e9c" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* PARİTE SEÇİM MODALI */}
      <Modal
        visible={showPairModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPairModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pairModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kripto Parite Seçin ({pairsList.length})</Text>
              <TouchableOpacity onPress={() => setShowPairModal(false)}>
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={16} color="#60a5fa" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Parite veya coin ara (Örn: BTC, SOL, PEPE)..."
                placeholderTextColor="#5e6673"
                value={pairSearchQuery}
                onChangeText={setPairSearchQuery}
                autoCapitalize="characters"
                clearButtonMode="while-editing"
              />
              {pairSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setPairSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#848e9c" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredPairs}
              keyExtractor={(item) => item.symbol}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pairListItem, selectedPair.symbol === item.symbol && styles.pairListItemActive]}
                  onPress={() => handleSelectPair(item)}
                >
                  <View style={styles.pairItemLeft}>
                    <View style={styles.coinAvatar}>
                      <Text style={styles.coinAvatarText}>{item.baseAsset.slice(0, 3)}</Text>
                    </View>
                    <View>
                      <Text style={styles.pairItemName}>{item.name}</Text>
                      <Text style={styles.pairItemSymbol}>USDT-M Vadeli</Text>
                    </View>
                  </View>
                  {selectedPair.symbol === item.symbol && (
                    <Ionicons name="checkmark-circle" size={18} color="#60a5fa" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* KALDIRAÇ AYARLAMA MODALI */}
      <Modal
        visible={showLeverageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLeverageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLeverageModal(false)}
        >
          <View style={styles.leverageModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kaldıraç Ayarla ({tempLeverage}x)</Text>
              <TouchableOpacity onPress={() => setShowLeverageModal(false)}>
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            <Text style={styles.leverageWarningText}>
              Yüksek kaldıraç pozisyonun likidasyon riskini artırır. Challenge sermayenizi korumak için dikkatli olun.
            </Text>

            <View style={styles.quickPillsRow}>
              {[2, 5, 10, 20, 50, 100].map((lev) => (
                <TouchableOpacity
                  key={lev}
                  style={[styles.quickLevBtn, tempLeverage === lev && styles.quickLevBtnActive]}
                  onPress={() => setTempLeverage(lev)}
                >
                  <Text style={[styles.quickLevText, tempLeverage === lev && styles.quickLevTextActive]}>
                    {lev}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.confirmModalBtn}
              onPress={() => {
                setLeverage(tempLeverage);
                setShowLeverageModal(false);
              }}
            >
              <Text style={styles.confirmModalBtnText}>Kaldıracı Onayla ({tempLeverage}x)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MOD SEÇİM MODALI (Alt Alta İki Kutu) */}
      <Modal
        visible={showModeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModeModal(false)}
        >
          <View style={styles.modeModalContent}>
            <View style={styles.modeModalHeader}>
              <View style={styles.modeModalTitleRow}>
                <Ionicons name="swap-horizontal" size={18} color="#60a5fa" />
                <Text style={styles.modeModalTitle}>İşlem Modu Seçin</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowModeModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modeModalSub}>
              İşlem yapmak istediğiniz simülasyon ortamını seçin:
            </Text>

            {/* KUTU 1: Anasayfa (Serbest Mod) */}
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardFreeInactive]}
              onPress={() => {
                setShowModeModal(false);
                setTimeout(() => {
                  setActiveMode('FREE');
                  router.replace('/');
                }, 50);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.modeCardLeft}>
                <View style={[styles.modeCardIconWrap, { backgroundColor: 'rgba(240, 185, 11, 0.15)' }]}>
                  <Ionicons name="flash" size={22} color="#f0b90b" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.modeCardTitleRow}>
                    <Text style={[styles.modeCardTitle, { color: '#f0b90b' }]}>Anasayfa (Serbest Mod)</Text>
                    <View style={[styles.modeCardBadge, { backgroundColor: 'rgba(240, 185, 11, 0.2)' }]}>
                      <Text style={[styles.modeCardBadgeText, { color: '#f0b90b' }]}>Turuncu Tema</Text>
                    </View>
                  </View>
                  <Text style={styles.modeCardDesc}>
                    Belirtilen miktar ve birim ile serbestçe trade yapabilmek aynı zamanda istendiği vakit para birimi değişikliği veya kur çevirimi olabiliyor.
                  </Text>
                  <Text style={styles.modeCardMeta}>
                    {hasCustomBalance
                      ? `Bakiye: ${freeCurrencySymbol}${freeDisplayBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${freeCurr}`
                      : 'Bakiye: Henüz Başlatılmadı (Girişte Seçilecek)'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#848e9c" />
            </TouchableOpacity>

            {/* KUTU 2: Trade (Challenge Mod) */}
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardChallengeActive]}
              onPress={() => {
                setActiveMode('CHALLENGE');
                setShowModeModal(false);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.modeCardLeft}>
                <View style={[styles.modeCardIconWrap, { backgroundColor: 'rgba(37, 99, 235, 0.25)' }]}>
                  <Ionicons name="trophy" size={22} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.modeCardTitleRow}>
                    <Text style={[styles.modeCardTitle, { color: '#60a5fa' }]}>Trade (Challenge Mod)</Text>
                    <View style={[styles.modeCardBadge, { backgroundColor: 'rgba(37, 99, 235, 0.3)' }]}>
                      <Text style={[styles.modeCardBadgeText, { color: '#60a5fa' }]}>Aktif</Text>
                    </View>
                  </View>
                  <Text style={styles.modeCardDesc}>
                    Başta kullanıcı tarafından girilen miktarı katlama amacı taşır ve başta belirtilen para birimi ile devam edilir dönüşüm olmaz.
                  </Text>
                  <Text style={styles.modeCardMeta}>
                    {activeChallenge.isConfigured
                      ? `Bakiye: ${currencySymbol}${activeChallenge.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${challengeCurrency}`
                      : 'Bakiye: Henüz Başlatılmadı (Girişte Seçilecek)'}
                  </Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 1. ADIM: SIFIRLAMA ONAY MODALI */}
      <Modal
        visible={showResetConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetConfirmModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowResetConfirmModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.resetConfirmCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.resetConfirmTopRow}>
              <View style={styles.resetConfirmIconCircle}>
                <Ionicons name="reload" size={22} color="#60a5fa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resetConfirmTitle}>Trade Challenge'ı Sıfırla</Text>
                <Text style={styles.resetConfirmSub}>Meydan Okuma Hesabı</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowResetConfirmModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            <View style={styles.resetConfirmNoticeBox}>
              <Ionicons name="alert-circle-outline" size={22} color="#f59e0b" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resetConfirmNoticeTitle}>Dikkat Edilmesi Gerekenler:</Text>
                <Text style={styles.resetConfirmNoticeText}>
                  • Varsa tüm açık challenge pozisyonlarınız, işlem geçmişiniz, portföy ve performans verileriniz sıfırlanacak.
                </Text>
                <Text style={styles.resetConfirmNoticeText}>
                  • Bir sonraki ekranda meydan okuma için yeni para birimi (₺ / $) ve başlangıç sermayesi belirleyebileceksiniz.
                </Text>
              </View>
            </View>

            <View style={styles.resetConfirmBtnRow}>
              <TouchableOpacity
                style={styles.resetConfirmCancelBtn}
                onPress={() => setShowResetConfirmModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.resetConfirmCancelText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetConfirmProceedBtn}
                onPress={() => {
                  setShowResetConfirmModal(false);
                  setSetupCurrency(activeChallenge.currency || 'TRY');
                  setSetupAmount(activeChallenge.currency === 'USD' ? '10000' : '100000');
                  setShowSetupModal(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-forward" size={16} color="#0b0e11" style={{ marginRight: 4 }} />
                <Text style={styles.resetConfirmProceedText}>Evet, Sıfırla</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* YETERSİZ BAKİYE UYARI MODALI */}
      <Modal
        visible={showInsufficientBalanceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInsufficientBalanceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInsufficientBalanceModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.insufficientModalCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Üst İkon & Başlık */}
            <View style={styles.insufficientHeaderRow}>
              <View style={styles.insufficientIconCircle}>
                <Ionicons name="wallet-outline" size={24} color="#f6465d" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.insufficientTitle}>Yetersiz Bakiye</Text>
                <Text style={styles.insufficientSub}>İşlem için gereken challenge marjı yetersiz</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowInsufficientBalanceModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.insufficientCloseBtn}
              >
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            {/* Finansal Detay Tablosu */}
            <View style={styles.insufficientDetailsBox}>
              <View style={styles.insufficientDetailRow}>
                <Text style={styles.insufficientDetailLabel}>Gereken Marjin</Text>
                <Text style={[styles.insufficientDetailValue, { color: '#eaecef' }]}>
                  {currencySymbol}{marginNum.toFixed(2)} {challengeCurrency}
                </Text>
              </View>
              <View style={styles.insufficientDivider} />
              <View style={styles.insufficientDetailRow}>
                <Text style={styles.insufficientDetailLabel}>Kullanılabilir Bakiye</Text>
                <Text style={[styles.insufficientDetailValue, { color: '#0ecb81' }]}>
                  {currencySymbol}{availableBalance.toFixed(2)} {challengeCurrency}
                </Text>
              </View>
              <View style={styles.insufficientDivider} />
              <View style={styles.insufficientDetailRow}>
                <Text style={styles.insufficientDetailLabel}>Eksik Tutar</Text>
                <Text style={[styles.insufficientDetailValue, { color: '#f6465d', fontWeight: 'bold' }]}>
                  {currencySymbol}{Math.max(0, marginNum - availableBalance).toFixed(2)} {challengeCurrency}
                </Text>
              </View>
            </View>

            {/* İpucu Kutusu */}
            <View style={styles.insufficientTipBoxBlue}>
              <Ionicons name="information-circle-outline" size={18} color="#60a5fa" style={{ marginTop: 1 }} />
              <Text style={styles.insufficientTipText}>
                Meydan okuma kuralları gereği bakiye sabittir. İşlem miktarını düşürerek veya kaldıracı artırarak gereken marjini azaltabilirsiniz.
              </Text>
            </View>

            {/* Butonlar */}
            <View style={styles.insufficientBtnRow}>
              <TouchableOpacity
                style={styles.insufficientCancelBtn}
                onPress={() => setShowInsufficientBalanceModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.insufficientCancelText}>Kapat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.insufficientActionBtnBlue}
                onPress={() => setShowInsufficientBalanceModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.insufficientActionTextBlue}>Anladım</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 2. ADIM: CHALLENGE KURULUM VE PARA BİRİMİ / MİKTAR SEÇİM MODALI */}
      <Modal
        visible={showSetupModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (activeChallenge.isConfigured) setShowSetupModal(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (activeChallenge.isConfigured) setShowSetupModal(false);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.setupModalCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.modeModalHeader}>
              <View style={styles.modeModalTitleRow}>
                <Ionicons name="trophy" size={22} color="#60a5fa" />
                <Text style={styles.modeModalTitle}>Trade Challenge Kurulumu</Text>
              </View>
              {activeChallenge.isConfigured && (
                <TouchableOpacity onPress={() => setShowSetupModal(false)}>
                  <Ionicons name="close" size={20} color="#848e9c" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.modeModalSub}>
              Sermaye katlama meydan okumanız için para birimi ve başlangıç bakiyenizi belirleyin:
            </Text>

            {/* Para Birimi Seçimi */}
            <Text style={styles.resetSectionLabel}>1. Para Birimi Seçin</Text>
            <View style={styles.resetCurrencyRow}>
              <TouchableOpacity
                style={[styles.resetCurrencyBtn, setupCurrency === 'TRY' && styles.resetCurrencyBtnActive]}
                onPress={() => {
                  setSetupCurrency('TRY');
                  setSetupAmount('100000');
                }}
              >
                <Text style={[styles.resetCurrencyText, setupCurrency === 'TRY' && styles.resetCurrencyTextActive]}>
                  ₺ Türk Lirası (TRY)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resetCurrencyBtn, setupCurrency === 'USD' && styles.resetCurrencyBtnActive]}
                onPress={() => {
                  setSetupCurrency('USD');
                  setSetupAmount('10000');
                }}
              >
                <Text style={[styles.resetCurrencyText, setupCurrency === 'USD' && styles.resetCurrencyTextActive]}>
                  $ Amerikan Doları (USD)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Önerilen Tutarlar */}
            <Text style={styles.resetSectionLabel}>2. Başlangıç Sermayesi</Text>
            <View style={styles.resetQuickAmountRow}>
              {setupCurrency === 'TRY' ? (
                <>
                  <TouchableOpacity style={styles.resetQuickPill} onPress={() => setSetupAmount('50000')}>
                    <Text style={styles.resetQuickPillText}>₺50.000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.resetQuickPill, setupAmount === '100000' && styles.resetQuickPillActive]} onPress={() => setSetupAmount('100000')}>
                    <Text style={[styles.resetQuickPillText, setupAmount === '100000' && styles.resetQuickPillTextActive]}>₺100.000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resetQuickPill} onPress={() => setSetupAmount('250000')}>
                    <Text style={styles.resetQuickPillText}>₺250.000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resetQuickPill} onPress={() => setSetupAmount('500000')}>
                    <Text style={styles.resetQuickPillText}>₺500.000</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.resetQuickPill} onPress={() => setSetupAmount('5000')}>
                    <Text style={styles.resetQuickPillText}>$5.000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.resetQuickPill, setupAmount === '10000' && styles.resetQuickPillActive]} onPress={() => setSetupAmount('10000')}>
                    <Text style={[styles.resetQuickPillText, setupAmount === '10000' && styles.resetQuickPillTextActive]}>$10.000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resetQuickPill} onPress={() => setSetupAmount('25000')}>
                    <Text style={styles.resetQuickPillText}>$25.000</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.resetQuickPill} onPress={() => setSetupAmount('50000')}>
                    <Text style={styles.resetQuickPillText}>$50.000</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <TextInput
              style={styles.resetTextInput}
              keyboardType="numeric"
              value={setupAmount}
              onChangeText={setSetupAmount}
              placeholder="Özel tutar girin..."
              placeholderTextColor="#5e6673"
            />

            <TouchableOpacity
              style={styles.setupConfirmBtn}
              onPress={handleStartChallenge}
            >
              <Ionicons name="trophy" size={18} color="#0b0e11" style={{ marginRight: 6 }} />
              <Text style={styles.setupConfirmBtnText}>Meydan Okumayı Başlat</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 2.1 ADIM: MEYDAN OKUMA BAŞLADI KUTUSU (ÖZEL TASARIM) */}
      <Modal
        visible={!!challengeStartedData}
        transparent
        animationType="fade"
        onRequestClose={() => setChallengeStartedData(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setChallengeStartedData(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.challengeStartedCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Üst Kupa İkon Rozeti */}
            <View style={styles.challengeSuccessBadge}>
              <View style={styles.challengeSuccessIconCircle}>
                <Ionicons name="trophy" size={38} color="#f59e0b" />
              </View>
            </View>

            <Text style={styles.challengeSuccessTitle}>Meydan Okuma Başladı! 🏆</Text>
            <Text style={styles.challengeSuccessSubtitle}>
              Trade Challenge hesabınız başarıyla yapılandırıldı. 2x Katlama hedefinize ulaşmak için işlemlerinize başlayabilirsiniz!
            </Text>

            {/* Bilgi Kutusu */}
            <View style={styles.challengeSuccessSummaryBox}>
              <View style={styles.challengeSuccessRow}>
                <Text style={styles.challengeSuccessLabel}>Başlangıç Sermayesi</Text>
                <Text style={styles.challengeSuccessVal}>
                  {challengeStartedData?.currency === 'TRY' ? '₺' : '$'}
                  {challengeStartedData?.amount.toLocaleString('tr-TR')}
                </Text>
              </View>

              <View style={styles.challengeSuccessRowDivider} />

              <View style={styles.challengeSuccessRow}>
                <Text style={styles.challengeSuccessLabel}>Hedef Sermaye (2X)</Text>
                <View style={styles.challengeTargetValGroup}>
                  <Text style={styles.challengeSuccessTargetVal}>
                    {challengeStartedData?.currency === 'TRY' ? '₺' : '$'}
                    {((challengeStartedData?.amount || 0) * 2).toLocaleString('tr-TR')}
                  </Text>
                  <View style={styles.challenge2xBadge}>
                    <Text style={styles.challenge2xBadgeText}>2X HEDEF</Text>
                  </View>
                </View>
              </View>

              <View style={styles.challengeSuccessRowDivider} />

              <View style={styles.challengeSuccessRow}>
                <Text style={styles.challengeSuccessLabel}>Para Birimi</Text>
                <Text style={styles.challengeSuccessCurrencyVal}>
                  {challengeStartedData?.currency === 'TRY' ? '₺ Türk Lirası (Sabit)' : '$ Amerikan Doları (Sabit)'}
                </Text>
              </View>
            </View>

            {/* Kural Bilgilendirmesi */}
            <View style={styles.challengeRuleHintBox}>
              <Ionicons name="information-circle" size={16} color="#3b82f6" style={{ marginRight: 6 }} />
              <Text style={styles.challengeRuleHintText}>
                Meydan okuma boyunca para birimi sabittir ve kur dönüşümü yapılamaz.
              </Text>
            </View>

            {/* Başla Butonu */}
            <TouchableOpacity
              style={styles.challengeSuccessActionBtn}
              onPress={() => setChallengeStartedData(null)}
              activeOpacity={0.85}
            >
              <Ionicons name="rocket-sharp" size={18} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.challengeSuccessActionBtnText}>İşlemlere Başla</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* POZİSYON KAPATMA ONAY MODALI */}
      <Modal
        visible={!!closingTargetPos}
        transparent
        animationType="fade"
        onRequestClose={() => setClosingTargetPos(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalHeader}>
              <Ionicons name="alert-circle" size={24} color="#f43f5e" />
              <Text style={styles.confirmModalTitle}>Pozisyonu Kapat</Text>
            </View>

            <Text style={styles.confirmModalDesc}>
              {closingTargetPos?.symbol} {closingTargetPos?.leverage}x {closingTargetPos?.side} pozisyonunuz piyasa fiyatından kapatılacak.
            </Text>

            <View style={styles.confirmModalBtnRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setClosingTargetPos(null)}
              >
                <Text style={styles.confirmCancelText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmProceedBtn}
                onPress={handleConfirmClose}
              >
                <Text style={styles.confirmProceedText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* TP / SL DÜZENLEME MODALI */}
      <Modal
        visible={!!editingPos}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPos(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tpSlModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>TP / SL Ayarla ({editingPos?.symbol})</Text>
              <TouchableOpacity onPress={() => setEditingPos(null)}>
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Kâr Al (TP) Fiyatı</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={editTpInput}
                onChangeText={setEditTpInput}
                placeholder="Örn: 98000"
                placeholderTextColor="#5e6673"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Zarar Durdur (SL) Fiyatı</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={editSlInput}
                onChangeText={setEditSlInput}
                placeholder="Örn: 92000"
                placeholderTextColor="#5e6673"
              />
            </View>

            <View style={styles.confirmModalBtnRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setEditingPos(null)}
              >
                <Text style={styles.confirmCancelText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmProceedBtn, { backgroundColor: '#3b82f6' }]}
                onPress={handleSaveTpSl}
              >
                <Text style={[styles.confirmProceedText, { color: '#ffffff' }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  mainScrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#0c121d',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a8a',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pairPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  pairIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairPickerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  challengeTag: {
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  challengeTagText: {
    color: '#60a5fa',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  modePickerBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  headerRightStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resetBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  balanceCurrencyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  balanceBarCol: {
    flex: 1,
  },
  balanceBarLabel: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceBarValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  currencyToggleCol: {
    alignItems: 'flex-end',
  },
  currencyToggleLabel: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  currencyLockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  currencyLockedText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  challengeProgressStrip: {
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  challengeProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  challengeProgressTitle: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  challengePnLBadge: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  progressBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  progressBarPercentText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '600',
  },
  globalMarketBar: {
    backgroundColor: '#0c1322',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e2d4d',
  },
  globalMarketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  globalMarketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  globalMarketTitle: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cmcBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cmcBadgeText: {
    color: '#60a5fa',
    fontSize: 9,
    fontWeight: '600',
  },
  metricsStrip: {
    gap: 8,
  },
  metricCard: {
    backgroundColor: '#111a2e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#1b2a47',
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  metricCardTitle: {
    color: '#848e9c',
    fontSize: 10,
  },
  metricCardValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metricCardSub: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  tickerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  livePriceText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  changePercentText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tickerMetaItem: {
    alignItems: 'flex-end',
  },
  tickerMetaLabel: {
    color: '#848e9c',
    fontSize: 10,
  },
  tickerMetaValue: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: '600',
  },
  viewSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#0c121d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  viewSegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    backgroundColor: '#111827',
  },
  viewSegmentBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  viewSegmentText: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: '600',
  },
  viewSegmentTextActive: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  chartAndBookContainer: {
    flexDirection: 'row',
    backgroundColor: '#0b0e11',
  },
  chartWrapper: {
    flex: 1,
  },
  timeframeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c121d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  timeframeScroll: {
    flex: 1,
    marginRight: 6,
  },
  timeframeScrollList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  tfBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  tfBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.3)',
  },
  tfBtnText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: '600',
  },
  tfBtnTextActive: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  chartToolsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  rulerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  rulerToggleBtnActive: {
    backgroundColor: '#60a5fa',
  },
  rulerToggleText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: 'bold',
  },
  rulerToggleTextActive: {
    color: '#0b0e11',
  },
  zoomControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 4,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  zoomBtn: {
    padding: 3,
  },
  zoomPercentText: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  chartContainer: {
    height: CHART_HEIGHT,
    backgroundColor: '#0b0e14',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  chartFloatingZoomBar: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    zIndex: 20,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  floatingZoomBtn: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 4,
  },
  floatingZoomLabelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingZoomLabelText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rulerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.01)',
    zIndex: 100,
    elevation: 100,
  },
  rulerMeasureBox2D: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderRadius: 3,
    zIndex: 35,
  },
  rulerHandleCircle: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 8,
    zIndex: 45,
  },
  rulerHandleInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rulerTvInfoCard: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 50,
  },
  rulerTvCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rulerTvHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rulerTvHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rulerTvPercentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  rulerTvPriceDiffText: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: '700',
  },
  rulerTvMetaText: {
    color: '#848e9c',
    fontSize: 9,
    fontWeight: '600',
  },
  rulerTvLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rulerTvLiveText: {
    color: '#0ecb81',
    fontSize: 9,
    fontWeight: '700',
  },
  rulerTvCardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 2,
    paddingTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  rulerTvActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 3.5,
    borderRadius: 4,
  },
  rulerTvActionBtnText: {
    color: '#848e9c',
    fontSize: 9,
    fontWeight: '600',
  },
  rulerCloseHeaderBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  rulerGuideLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rulerLineDashed: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  rulerLineSolid: {
    flex: 1,
    height: 1.5,
  },
  rulerTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
    marginRight: 8,
  },
  rulerTagP1: {
    backgroundColor: 'rgba(240, 185, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#f0b90b',
  },
  rulerTagP2: {
    backgroundColor: 'rgba(41, 98, 255, 0.25)',
    borderWidth: 1,
    borderColor: '#2962ff',
  },
  rulerTagLiveUp: {
    backgroundColor: 'rgba(14, 203, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#0ecb81',
  },
  rulerTagLiveDown: {
    backgroundColor: 'rgba(246, 70, 93, 0.25)',
    borderWidth: 1,
    borderColor: '#f6465d',
  },
  rulerTagLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: 'bold',
  },
  rulerTagPrice: {
    color: '#eaecef',
    fontSize: 10,
    fontWeight: 'bold',
  },
  rulerTopControls: {
    position: 'absolute',
    top: 6,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rulerHelpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  rulerHelpText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '500',
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0ecb81',
    marginLeft: 3,
  },
  // Giriş Çizgisi Dokunma & Taşıma Katmanı Stilleri
  entryLineTouchOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.005)',
    zIndex: 42,
    elevation: 42,
  },
  entrySmallBadgeFloating: {
    position: 'absolute',
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(11, 14, 20, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#f0b90b',
    zIndex: 48,
    elevation: 48,
  },
  entrySmallBadgeText: {
    color: '#f0b90b',
    fontSize: 10,
    fontWeight: '700',
  },
  entrySmallCloseBtn: {
    padding: 2,
  },
  // Grafik Üzeri Açık Pozisyon Giriş ve Hedef Seviye Çizgileri (Sağ Fiyat Ekseninden Başlayan Çizgiler)
  chartEntryRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 14,
  },
  chartEntryLeftBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  chartEntryLeftBadgeText: {
    color: '#0b0e11',
    fontSize: 9,
    fontWeight: '800',
  },
  chartEntryLine: {
    flex: 1,
    height: 1.5,
    opacity: 0.95,
  },
  chartEntryRightBadge: {
    width: 62,
    height: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: -1, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  chartEntryRightBadgeText: {
    color: '#0b0e11',
    fontSize: 9.5,
    fontWeight: '800',
  },
  chartTpSlLeftBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  chartTpSlLine: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.85,
  },
  chartTpSlBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  chartTpSlRightBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  orderBookWrapper: {
    backgroundColor: '#0c121d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 10,
  },
  orderBookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  obHeadText: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
  },
  obList: {
    gap: 2,
  },
  obRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    position: 'relative',
  },
  obDepthBarAsk: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(246, 70, 93, 0.15)',
  },
  obDepthBarBid: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 203, 129, 0.15)',
  },
  obPriceAsk: {
    color: '#f6465d',
    fontSize: 11,
    fontWeight: '600',
  },
  obPriceBid: {
    color: '#0ecb81',
    fontSize: 11,
    fontWeight: '600',
  },
  obAmount: {
    color: '#848e9c',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  obMidPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  obMidPriceText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  orderFormCard: {
    backgroundColor: '#0c121d',
    margin: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  sideToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  sideBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  sideBtnInactive: {
    backgroundColor: '#111827',
  },
  sideBtnLongActive: {
    backgroundColor: '#0ecb81',
  },
  sideBtnShortActive: {
    backgroundColor: '#f6465d',
  },
  sideBtnText: {
    color: '#848e9c',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sideBtnTextActive: {
    color: '#ffffff',
  },
  typeLeverageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderTypeTabs: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 6,
    padding: 2,
  },
  orderTypeTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  orderTypeTabActive: {
    backgroundColor: '#1e3a8a',
  },
  orderTypeText: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: '600',
  },
  orderTypeTextActive: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  leverageModeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  marginModeBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  marginModeText: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: '600',
  },
  leverageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  leverageBtnText: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  inputWrapper: {
    marginBottom: 10,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: '600',
  },
  inputActionText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: 'bold',
  },
  inputSubLabel: {
    color: '#848e9c',
    fontSize: 11,
  },
  formInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    color: '#eaecef',
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  marginInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    paddingHorizontal: 12,
  },
  marginInputPrefix: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 6,
  },
  marginTextInput: {
    flex: 1,
    color: '#eaecef',
    fontSize: 14,
    fontWeight: 'bold',
    paddingVertical: 8,
  },
  marginInputSuffix: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: '600',
  },
  quickPercentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickPercentBtn: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quickPercentText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tpSlToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  tpSlToggleTitle: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tpSlToggleSub: {
    color: '#5e6673',
    fontSize: 10,
    marginTop: 1,
  },
  tpSlExpandedContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  tpSlInputGroup: {
    gap: 4,
  },
  tpSlInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tpSlInputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  quickPillsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  quickPillBtn: {
    backgroundColor: '#111827',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quickPillText: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
  },
  costInfoCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1e2d4d',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    color: '#848e9c',
    fontSize: 11,
  },
  costValue: {
    color: '#eaecef',
    fontSize: 12,
    fontWeight: '600',
  },
  mainOrderBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainOrderBtnLong: {
    backgroundColor: '#0ecb81',
  },
  mainOrderBtnShort: {
    backgroundColor: '#f6465d',
  },
  mainOrderBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  bottomTerminal: {
    backgroundColor: '#0c121d',
    borderTopWidth: 1,
    borderTopColor: '#1e3a8a',
  },
  bottomTabHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  bottomTabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bottomTabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  bottomTabText: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomTabTextActive: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  terminalContent: {
    padding: 12,
    gap: 12,
  },
  emptyTerminalBox: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyTerminalText: {
    color: '#eaecef',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyTerminalSubText: {
    color: '#5e6673',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  positionCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    gap: 8,
  },
  posCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  posBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  posSymbolText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  posSideTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bgLongTag: {
    backgroundColor: 'rgba(14, 203, 129, 0.2)',
  },
  bgShortTag: {
    backgroundColor: 'rgba(246, 70, 93, 0.2)',
  },
  posSideTagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  posIsolatedTag: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  posIsolatedTagText: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
  },
  posPnlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    borderRadius: 8,
  },
  posLabel: {
    color: '#848e9c',
    fontSize: 11,
    marginBottom: 2,
  },
  posPnlValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  posRoeValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  twoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colHalf: {
    flex: 1,
  },
  posValue: {
    color: '#eaecef',
    fontSize: 12,
    fontWeight: '600',
  },
  posValueBold: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tpSlTwoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  editTpSlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  editTpSlText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 4,
  },
  closePositionFullBtn: {
    width: '100%',
    backgroundColor: '#162030',
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#26354a',
  },
  closePositionFullBtnText: {
    color: '#f43f5e',
    fontSize: 13,
    fontWeight: 'bold',
  },
  rulesCard: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  ruleItem: {
    flexDirection: 'row',
    gap: 10,
  },
  ruleTitle: {
    color: '#eaecef',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  ruleSub: {
    color: '#848e9c',
    fontSize: 11,
    lineHeight: 16,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  historySymbol: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  historyTime: {
    color: '#848e9c',
    fontSize: 11,
    marginTop: 2,
  },
  historyPnL: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  orderToastContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  orderToastContent: {
    backgroundColor: '#0d192e',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    elevation: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  orderToastIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderToastTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  orderToastTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  toastSideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  orderToastDesc: {
    color: '#93c5fd',
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pairModalContent: {
    backgroundColor: '#0c121d',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '75%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  searchInput: {
    flex: 1,
    color: '#eaecef',
    fontSize: 13,
    paddingVertical: 8,
  },
  pairListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pairListItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  pairItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinAvatarText: {
    color: '#60a5fa',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pairItemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  pairItemSymbol: {
    color: '#848e9c',
    fontSize: 11,
  },
  leverageModalContent: {
    backgroundColor: '#0c121d',
    margin: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  leverageWarningText: {
    color: '#848e9c',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  quickLevBtn: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  quickLevBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
  },
  quickLevText: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickLevTextActive: {
    color: '#ffffff',
  },
  confirmModalBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmModalBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modeModalContent: {
    backgroundColor: '#0c121d',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e3a8a',
  },
  modeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeModalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modeModalSub: {
    color: '#848e9c',
    fontSize: 12,
    marginBottom: 4,
  },
  modeCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeCardFreeInactive: {
    borderColor: 'rgba(240, 185, 11, 0.4)',
  },
  modeCardChallengeActive: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
  },
  modeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modeCardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  modeCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modeCardBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeCardBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  modeCardDesc: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 4,
  },
  modeCardMeta: {
    color: '#64748b',
    fontSize: 10,
  },
  resetConfirmCard: {
    backgroundColor: '#0c121d',
    borderRadius: 16,
    padding: 18,
    margin: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderWidth: 1,
    borderColor: '#1e3a8a',
    gap: 14,
  },
  resetConfirmTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resetConfirmIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetConfirmTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  resetConfirmSub: {
    color: '#60a5fa',
    fontSize: 11,
  },
  resetConfirmNoticeBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    flexDirection: 'row',
  },
  resetConfirmNoticeTitle: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  resetConfirmNoticeText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },
  resetConfirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resetConfirmCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  resetConfirmCancelText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  resetConfirmProceedBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
  },
  resetConfirmProceedText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  setupModalCard: {
    backgroundColor: '#0c121d',
    borderRadius: 16,
    padding: 18,
    margin: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderWidth: 1,
    borderColor: '#1e3a8a',
    gap: 12,
  },
  resetSectionLabel: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  resetCurrencyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resetCurrencyBtn: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  resetCurrencyBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    borderColor: '#3b82f6',
  },
  resetCurrencyText: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: '600',
  },
  resetCurrencyTextActive: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  resetQuickAmountRow: {
    flexDirection: 'row',
    gap: 6,
  },
  resetQuickPill: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  resetQuickPillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
  },
  resetQuickPillText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: '600',
  },
  resetQuickPillTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  resetTextInput: {
    backgroundColor: '#111827',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  setupConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 6,
  },
  setupConfirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmModalCard: {
    backgroundColor: '#0c121d',
    borderRadius: 16,
    padding: 18,
    margin: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderWidth: 1,
    borderColor: '#1e3a8a',
    gap: 12,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmModalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  confirmModalDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  confirmModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#111827',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  confirmCancelText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmProceedBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f43f5e',
    alignItems: 'center',
  },
  confirmProceedText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tpSlModalCard: {
    backgroundColor: '#0c121d',
    borderRadius: 16,
    padding: 18,
    margin: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    borderWidth: 1,
    borderColor: '#1e3a8a',
    gap: 12,
  },

  // Yetersiz Bakiye Modal Stilleri
  insufficientModalCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#0c121d',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  insufficientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  insufficientIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(246, 70, 93, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(246, 70, 93, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#eaecef',
  },
  insufficientSub: {
    fontSize: 11,
    color: '#848e9c',
    marginTop: 2,
  },
  insufficientCloseBtn: {
    padding: 4,
  },
  insufficientDetailsBox: {
    backgroundColor: '#070b12',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  insufficientDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  insufficientDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 4,
  },
  insufficientDetailLabel: {
    fontSize: 12,
    color: '#848e9c',
  },
  insufficientDetailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#eaecef',
  },
  insufficientTipBoxBlue: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 16,
  },
  insufficientTipText: {
    flex: 1,
    fontSize: 11,
    color: '#93c5fd',
    lineHeight: 16,
  },
  insufficientBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  insufficientCancelBtn: {
    flex: 1,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  insufficientCancelText: {
    color: '#eaecef',
    fontSize: 13,
    fontWeight: '600',
  },
  insufficientActionBtnBlue: {
    flex: 1.3,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientActionTextBlue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Meydan Okuma Başladı Özel Modal Tasarımı
  challengeStartedCard: {
    backgroundColor: '#161922',
    width: '100%',
    maxWidth: 390,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },
  challengeSuccessBadge: {
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeSuccessIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeSuccessTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  challengeSuccessSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  challengeSuccessSummaryBox: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  challengeSuccessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  challengeSuccessRowDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 6,
  },
  challengeSuccessLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  challengeSuccessVal: {
    fontSize: 14,
    color: '#f1f5f9',
    fontWeight: 'bold',
  },
  challengeSuccessTargetVal: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: 'bold',
    marginRight: 6,
  },
  challengeTargetValGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challenge2xBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  challenge2xBadgeText: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: 'bold',
  },
  challengeSuccessCurrencyVal: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
  },
  challengeRuleHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    marginBottom: 18,
    width: '100%',
  },
  challengeRuleHintText: {
    fontSize: 11,
    color: '#93c5fd',
    flex: 1,
    lineHeight: 15,
  },
  challengeSuccessActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  challengeSuccessActionBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
