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

export default function TradeScreen() {
  const insets = useSafeAreaInsets();
  const [selectedPair, setSelectedPair] = useState<CryptoPair>(AVAILABLE_PAIRS[0]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [marginMode, setMarginMode] = useState<'CROSS' | 'ISOLATED'>('CROSS');
  const [leverage, setLeverage] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>(AVAILABLE_PAIRS[0].defaultAmount);
  const [activeViewTab, setActiveViewTab] = useState<'CHART' | 'ORDERBOOK' | 'SPLIT'>('SPLIT');

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

  const formatPricePrecision = (price: number) => {
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

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

  // Zustand Store
  const {
    positions,
    openPosition,
    closePosition,
    updateMarketPrice,
    availableBalance,
    balance,
    syncBinanceBalance,
    activeMode,
    setActiveMode,
    challenge,
    currency,
    usdTryRate,
    setCurrency,
    resetFreeBalance,
    fetchUsdTryRate,
    hasCustomBalance,
    isHydrated,
  } = useTradeStore();

  const [marginInput, setMarginInput] = useState<string>('1000');
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showInsufficientBalanceModal, setShowInsufficientBalanceModal] = useState<boolean>(false);
  const [resetCurrency, setResetCurrency] = useState<'TRY' | 'USD'>('TRY');
  const [resetCustomAmount, setResetCustomAmount] = useState<string>('500000');
  const [walletResetSuccessData, setWalletResetSuccessData] = useState<{
    amount: number;
    currency: 'TRY' | 'USD';
    isFirstTime: boolean;
  } | null>(null);
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

  // Akıllı ve Hassas Fiyat Formatlayıcı (Altcoinler, PEPE ve BTC gibi tüm varlıklarda $0.00 hatasını engeller)
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
  const currentOpenPosition = positions.find((p) => p.symbol === symbol);
  const effectiveEntryPrice = currentOpenPosition?.entryPrice || 0;
  const entryGuideY = priceToY(effectiveEntryPrice);
  const entryDiff = effectiveEntryPrice > 0 ? effectiveEntryPrice - currentPrice : 0;

  // Seçili coin değiştiğinde veya o coinde açık pozisyon yoksa giriş çizgisini kapat
  useEffect(() => {
    const hasPosition = positions.some((p) => p.symbol === symbol);
    if (!hasPosition) {
      setIsEntryGuideActive(false);
    }
  }, [symbol, positions]);

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

  // Uygulamaya ilk girildiğinde (kullanıcı henüz bakiye belirlemediyse) anasayfada para birimi ve tutarını sor
  useEffect(() => {
    if (isHydrated && !hasCustomBalance) {
      const timer = setTimeout(() => {
        if (activeMode !== 'FREE') {
          setActiveMode('FREE');
        }
        setShowResetModal(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isHydrated, hasCustomBalance]);

  useEffect(() => {
    fetchUsdTryRate();
    syncBinanceBalance();
    fetchGlobalMarketData().then(setGlobalMarket);

    // 1. REST Fiyat ve 24h İstatistik
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

    // 2. Canlı WebSocket Fiyat Akışı (aynı zamanda mumun anlık tepe/dip seviyesini de günceller)
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

    // 3. Canlı WebSocket Emir Defteri (Order Book)
    const unsubscribeDepth = subscribeToOrderBook(symbol, (depth) => {
      setOrderBook(depth);
    });

    return () => {
      unsubscribePrice();
      unsubscribeDepth();
    };
  }, [symbol]);

  // Binance'deki tüm aktif USDT-M vadeli pariteleri dinamik olarak çek
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

  // Harf veya sembol aramasına göre pariteleri filtrele (o harfle başlayanlar en üstte)
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
    setShowPairModal(false);
  };

  // Para Birimi ve Dönüşüm Hesaplamaları
  const currencySymbol = currency === 'TRY' ? '₺' : '$';
  const rate = currency === 'TRY' ? usdTryRate : 1;

  // Emir Hesaplamaları (İşlem Marjı Esaslı)
  const executionPrice = orderType === 'LIMIT' && parseFloat(limitPrice) > 0 ? parseFloat(limitPrice) : currentPrice;
  const marginNum = parseFloat(marginInput || '0');
  const marginInUsd = rate > 0 ? marginNum / rate : marginNum;
  const positionVolumeSelected = marginNum * leverage;
  const positionVolumeUsd = marginInUsd * leverage;
  const coinQuantity = executionPrice > 0 ? positionVolumeUsd / executionPrice : 0;
  const estimatedFeeSelected = positionVolumeSelected * 0.0005; // %0.05 komisyon
  const estLiquidation = calculateLiquidationPrice(
    executionPrice,
    leverage,
    side,
    marginMode,
    marginMode === 'CROSS' ? Math.max(0, availableBalance - marginInUsd) : 0,
    coinQuantity
  );

  const availableInSelectedCurrency = availableBalance * rate;

  const handleQuickPercent = (percent: number) => {
    if (availableInSelectedCurrency <= 0) return;
    const targetMargin = availableInSelectedCurrency * (percent / 100);
    setMarginInput(targetMargin >= 100 ? targetMargin.toFixed(0) : targetMargin.toFixed(2));
  };

  const handleToggleCurrency = (newCurr: 'TRY' | 'USD') => {
    if (newCurr === currency) return;
    const currentNum = parseFloat(marginInput || '0');
    if (currentNum > 0) {
      if (newCurr === 'TRY') {
        setMarginInput((currentNum * usdTryRate).toFixed(0));
      } else {
        setMarginInput((currentNum / usdTryRate).toFixed(2));
      }
    }
    setCurrency(newCurr);
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

    if (marginInUsd > availableBalance) {
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

    const success = await openPosition({
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
      Alert.alert('Hata', 'Pozisyon açılamadı. Lütfen bakiyenizi kontrol edin.');
    }
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

  // Toplam açık pozisyon sayısı ve gerçekleşmemiş PnL
  const totalOpenPositions = positions.length;
  const totalUnrealizedPnL = useMemo(() => {
    return positions.reduce((sum, pos) => {
      return sum + calculatePnL(pos.entryPrice, pos.currentPrice, pos.amount, pos.side);
    }, 0);
  }, [positions]);

  const totalEquityUsd = balance + totalUnrealizedPnL;
  const totalEquityInSelectedCurrency = totalEquityUsd * rate;

  const formatMoney = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleOpenResetDialog = () => {
    setShowResetConfirmModal(true);
  };

  const handleConfirmReset = (amountNum: number, curr: 'TRY' | 'USD') => {
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir başlangıç bakiyesi girin.');
      return;
    }
    const isFirstTime = !hasCustomBalance;
    const amountInUsd = curr === 'TRY' ? amountNum / usdTryRate : amountNum;
    setCurrency(curr);
    resetFreeBalance(amountInUsd);
    setShowResetModal(false);
    setWalletResetSuccessData({
      amount: amountNum,
      currency: curr,
      isFirstTime,
    });
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
        {/* 1. ÜST TICKER & BAŞLIK BARI (Trade Simulation Header) */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 2 }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={styles.pairPickerBtn}
              onPress={() => setShowPairModal(true)}
              activeOpacity={0.8}
            >
              <View style={styles.pairIconBadge}>
                <Ionicons name="swap-vertical" size={14} color="#f0b90b" />
              </View>
              <Text style={styles.pairPickerTitle}>{selectedPair.name}</Text>
              <View style={styles.perpTag}>
                <Text style={styles.perpTagText}>Perp</Text>
              </View>
              <Ionicons name="chevron-down" size={14} color="#848e9c" />
            </TouchableOpacity>

            {/* SAĞ ÜSTTE: PARİTENİN SAĞINDA MOD SEÇİCİ */}
            <TouchableOpacity
              style={styles.modePickerBtn}
              onPress={() => setShowModeModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={12} color="#f0b90b" />
              <Text style={styles.modePickerBtnText}>Serbest Mod</Text>
              <Ionicons name="chevron-down" size={11} color="#f0b90b" />
            </TouchableOpacity>
          </View>

          <View style={styles.headerRightStats}>
            {/* CÜZDAN SIFIRLAMA BUTONU */}
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleOpenResetDialog}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="reload" size={15} color="#f0b90b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* EN ÜST SATIRIN HEMEN ALTINDA: Toplam Tutar, Kullanılabilir Bakiye, Para Birimi Seçimi (Hepsi Aynı Satırda) */}
        <View style={styles.balanceCurrencyBar}>
          <View style={styles.balanceBarCol}>
            <Text style={styles.balanceBarLabel}>Toplam Tutar</Text>
            <Text style={styles.balanceBarValue}>
              {formatMoney(totalEquityInSelectedCurrency)}
            </Text>
          </View>

          <View style={styles.balanceBarCol}>
            <Text style={styles.balanceBarLabel}>Kullanılabilir Bakiye</Text>
            <Text style={[styles.balanceBarValue, { color: '#0ecb81' }]}>
              {formatMoney(availableInSelectedCurrency)}
            </Text>
          </View>

          <View style={styles.currencyToggleCol}>
            <Text style={styles.currencyToggleLabel}>Para Birimi</Text>
            <View style={styles.currencyToggleGroup}>
              <TouchableOpacity
                style={[styles.currencyPill, currency === 'TRY' && styles.currencyPillActive]}
                onPress={() => handleToggleCurrency('TRY')}
                activeOpacity={0.8}
              >
                <Text style={[styles.currencyPillText, currency === 'TRY' && styles.currencyPillTextActive]}>
                  ₺ TRY
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.currencyPill, currency === 'USD' && styles.currencyPillActive]}
                onPress={() => handleToggleCurrency('USD')}
                activeOpacity={0.8}
              >
                <Text style={[styles.currencyPillText, currency === 'USD' && styles.currencyPillTextActive]}>
                  $ Dolar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* GLOBAL KRİPTO PİYASASI (COINMARKETCAP VERİLERİ) */}
        <View style={styles.globalMarketBar}>
          <View style={styles.globalMarketHeader}>
            <View style={styles.globalMarketTitleRow}>
              <Ionicons name="earth" size={12} color="#f0b90b" />
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
            {/* 1. Toplam Piyasa Değeri (Total Market Cap) */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <Ionicons name="pie-chart-outline" size={12} color="#f0b90b" />
                <Text style={styles.metricCardTitle}>Toplam Piyasa Değeri</Text>
              </View>
              <Text style={styles.metricCardValue}>
                {formatCompactCurrency(globalMarket.totalMarketCapUsd, currency, usdTryRate)}
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

            {/* 2. Toplam 24s Hacim (Total Volume) */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <Ionicons name="bar-chart-outline" size={12} color="#0ecb81" />
                <Text style={styles.metricCardTitle}>24s Toplam Hacim</Text>
              </View>
              <Text style={styles.metricCardValue}>
                {formatCompactCurrency(globalMarket.totalVolume24hUsd, currency, usdTryRate)}
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

            {/* 3. BTC Hakimiyeti (BTC Dominance) */}
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
                {globalMarket.btcDominanceChange24h.toFixed(2)}% (24s)
              </Text>
            </View>

            {/* 4. ETH Hakimiyeti (ETH Dominance) */}
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

            {/* 5. Aktif Kripto Para (Active Cryptocurrencies) */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <Ionicons name="layers-outline" size={12} color="#00bcd4" />
                <Text style={styles.metricCardTitle}>Aktif Kriptolar</Text>
              </View>
              <Text style={[styles.metricCardValue, { color: '#00bcd4' }]}>
                {globalMarket.activeCryptocurrencies.toLocaleString('tr-TR')}
              </Text>
              <Text style={styles.metricCardSub}>Listelenen Coin</Text>
            </View>

            {/* 6. Korku ve Açgözlülük (Fear & Greed) */}
            <View style={styles.metricCard}>
              <View style={styles.metricCardHeader}>
                <Ionicons name="speedometer-outline" size={12} color="#f0b90b" />
                <Text style={styles.metricCardTitle}>Korku & Açgözlülük</Text>
              </View>
              <Text
                style={[
                  styles.metricCardValue,
                  {
                    color:
                      globalMarket.fearAndGreedValue >= 55
                        ? '#0ecb81'
                        : globalMarket.fearAndGreedValue <= 45
                        ? '#f6465d'
                        : '#f0b90b',
                  },
                ]}
              >
                %{globalMarket.fearAndGreedValue} / 100
              </Text>
              <Text
                style={[
                  styles.metricCardSub,
                  {
                    color:
                      globalMarket.fearAndGreedValue >= 55
                        ? '#0ecb81'
                        : globalMarket.fearAndGreedValue <= 45
                        ? '#f6465d'
                        : '#f0b90b',
                  },
                ]}
              >
                {globalMarket.fearAndGreedClassification}
              </Text>
            </View>
          </ScrollView>
        </View>

        {/* 24h Ticker Verileri */}
        <View style={styles.tickerStrip}>
          <View>
            <Text
              style={[
                styles.livePriceText,
                { color: (ticker24h?.priceChangePercent ?? 0) >= 0 ? '#0ecb81' : '#f6465d' },
              ]}
            >
              {currentPrice > 0
                ? `$${currentPrice.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: currentPrice < 1 ? 4 : 2,
                  })}`
                : '---'}
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
            <Text style={styles.tickerMetaLabel}>24s Yüksek</Text>
            <Text style={styles.tickerMetaValue}>
              {ticker24h?.highPrice ? `$${ticker24h.highPrice.toLocaleString('en-US')}` : '---'}
            </Text>
          </View>

          <View style={styles.tickerMetaItem}>
            <Text style={styles.tickerMetaLabel}>24s Düşük</Text>
            <Text style={styles.tickerMetaValue}>
              {ticker24h?.lowPrice ? `$${ticker24h.lowPrice.toLocaleString('en-US')}` : '---'}
            </Text>
          </View>

          <View style={styles.tickerMetaItem}>
            <Text style={styles.tickerMetaLabel}>24s Hacim</Text>
            <Text style={styles.tickerMetaValue}>
              {ticker24h?.quoteVolume ? `$${(ticker24h.quoteVolume / 1000000).toFixed(1)}M` : '---'}
            </Text>
          </View>
        </View>
      </View>

      {/* ZAMAN DİLİMLERİ & CETVEL & DÜZENLE BARI */}
      <View style={styles.timeframeBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.timeframeScroll}
          contentContainerStyle={styles.timeframeList}
        >
          {TIMEFRAMES.map((tf) => (
            <TouchableOpacity
              key={tf.value}
              style={[
                styles.timeframeBtn,
                selectedInterval === tf.value && styles.timeframeBtnActive,
              ]}
              onPress={() => setSelectedInterval(tf.value)}
            >
              <Text
                style={[
                  styles.timeframeText,
                  selectedInterval === tf.value && styles.timeframeTextActive,
                ]}
              >
                {tf.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* SAĞ TARAFTA GİRİŞ VE CETVEL BUTONLARI */}
        <View style={styles.chartToolbarRightGroup}>
          {currentOpenPosition && (
            <TouchableOpacity
              style={[styles.toolbarToolBtn, isEntryGuideActive && styles.toolbarToolBtnActive]}
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
              <Text style={[styles.toolbarToolBtnText, isEntryGuideActive && styles.toolbarToolBtnTextActive]}>
                {isEntryGuideActive ? 'Giriş Açık' : 'Giriş'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.toolbarToolBtn, isRulerActive && styles.toolbarToolBtnActive]}
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
            <Ionicons
              name={isRulerActive ? 'contract' : 'contract-outline'}
              size={12}
              color={isRulerActive ? '#0b0e11' : '#f0b90b'}
            />
            <Text style={[styles.toolbarToolBtnText, isRulerActive && styles.toolbarToolBtnTextActive]}>
              {isRulerActive ? 'Cetvel Açık' : 'Cetvel'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TRADINGVIEW GRAFİĞİ (Orijinal Kenardan Kenara Temiz ve Geniş Görünüm) */}
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
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={tradingViewHtml}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              pointerEvents: isRulerActive ? 'none' : 'auto',
            }}
            title="TradingView Chart"
          />
        ) : (
          <WebView
            ref={webViewRef}
            key={`chart-${selectedInterval}-${symbol}`}
            originWhitelist={['*']}
            source={{ html: tradingViewHtml }}
            style={styles.webview}
            scrollEnabled={!isRulerActive}
            pointerEvents={isRulerActive ? 'none' : 'auto'}
            nestedScrollEnabled={true}
            overScrollMode="never"
            scalesPageToFit={true}
          />
        )}

        {/* AÇIK POZİSYON SL ÇİZGİSİ (Yeşil kesik kesik TP çizgisi tamamen kaldırıldı) */}
        {positions
          .filter((pos) => pos.symbol === symbol)
          .map((pos) => {
            const slY = pos.stopLoss ? priceToY(pos.stopLoss) : null;
            return (
              <View
                key={`pos-overlay-${pos.id}`}
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

        {/* GRAFİK ÜZERİ ETKİLEŞİMLİ CETVEL OVERLAY (TRADINGVIEW STİLİ PANRESPONDER İLE %100 ÇALIŞIR) */}
        {isRulerActive && (
          <View
            style={styles.rulerOverlay}
            collapsable={false}
            {...rulerPanResponder.panHandlers}
          >
            {/* Üst Yardımcı & Kapatma Butonu */}
            <View style={styles.rulerTopControls} pointerEvents="box-none">
              <View style={styles.rulerHelpPill}>
                <Ionicons name="sparkles" size={12} color="#f0b90b" />
                <Text style={styles.rulerHelpText}>
                  Tutamaçları veya ölçüm kutusunu sürükleyebilirsiniz
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

            {/* TradingView Ölçüm Kutusu */}
            {rulerPoint1 && rulerPoint2 && (
              <>
                <View
                  style={[
                    styles.rulerMeasureBox2D,
                    {
                      top: Math.min(displayP1Y, displayP2Y),
                      left: Math.min(displayP1X, displayP2X),
                      width: Math.max(20, Math.abs(displayP2X - displayP1X)),
                      height: Math.max(2, Math.abs(displayP2Y - displayP1Y)),
                      backgroundColor: rulerDiff >= 0
                        ? 'rgba(14, 203, 129, 0.16)'
                        : 'rgba(246, 70, 93, 0.16)',
                      borderColor: rulerDiff >= 0
                        ? 'rgba(14, 203, 129, 0.7)'
                        : 'rgba(246, 70, 93, 0.7)',
                    },
                  ]}
                  pointerEvents="none"
                />

                {/* Nokta 1: Altın Sarısı Yatay Kılavuz Çizgisi */}
                <View style={[styles.rulerGuideLine, { top: displayP1Y }]} pointerEvents="none">
                  <View style={[styles.rulerLineSolid, { backgroundColor: '#f0b90b' }]} />
                  <View style={[styles.rulerTag, styles.rulerTagP1]}>
                    <Text style={styles.rulerTagLabel}>Nokta 1</Text>
                    <Text style={styles.rulerTagPrice}>${formatSmartPrice(p1Price)}</Text>
                  </View>
                </View>

                {/* Nokta 2: Mavi Yatay Kılavuz Çizgisi (Kesik kesik yeşil yok!) */}
                <View style={[styles.rulerGuideLine, { top: displayP2Y }]} pointerEvents="none">
                  <View style={[styles.rulerLineSolid, { backgroundColor: '#3b82f6' }]} />
                  <View style={[styles.rulerTag, styles.rulerTagP2]}>
                    <Text style={styles.rulerTagLabel}>
                      {rulerTrackingLive ? '⚡ Canlı Fiyat' : 'Nokta 2'}
                    </Text>
                    <Text style={styles.rulerTagPrice}>${formatSmartPrice(p2Price)}</Text>
                  </View>
                </View>

                {/* Tutamaç 1 (Handle P1) */}
                <View
                  style={[
                    styles.rulerHandleCircle,
                    { left: displayP1X - 11, top: displayP1Y - 11, borderColor: '#f0b90b' },
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.rulerHandleInnerDot, { backgroundColor: '#f0b90b' }]} />
                </View>

                {/* Tutamaç 2 (Handle P2) */}
                <View
                  style={[
                    styles.rulerHandleCircle,
                    {
                      left: displayP2X - 11,
                      top: displayP2Y - 11,
                      borderColor: '#3b82f6',
                    },
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.rulerHandleInnerDot, { backgroundColor: '#3b82f6' }]} />
                </View>

                {/* TradingView Bilgi Kartı (Grafiğin alt kısmına sabitlenmiş geniş ve şık panel) */}
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
                        color={rulerTrackingLive ? '#f0b90b' : '#848e9c'}
                      />
                      <Text style={[styles.rulerTvActionBtnText, rulerTrackingLive && { color: '#f0b90b' }]}>
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

        {/* 4. GELİŞMİŞ BORSA EMİR FORMU (Trade Simulation Order Panel) */}
        <View style={styles.orderPanel}>
          {/* Marjin Modu & Kaldıraç Çubuğu */}
          <View style={styles.marginLeverageBar}>
            <TouchableOpacity
              style={styles.controlPill}
              onPress={() => setMarginMode(marginMode === 'CROSS' ? 'ISOLATED' : 'CROSS')}
            >
              <Text style={styles.controlPillText}>{marginMode === 'CROSS' ? 'Çapraz (Cross)' : 'İzole (Isolated)'}</Text>
              <Ionicons name="caret-down" size={10} color="#848e9c" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlPill}
              onPress={() => {
                setTempLeverage(leverage);
                setShowLeverageModal(true);
              }}
            >
              <Text style={[styles.controlPillText, { color: '#f0b90b', fontWeight: 'bold' }]}>{leverage}x</Text>
              <Ionicons name="caret-down" size={10} color="#848e9c" />
            </TouchableOpacity>

            <View style={styles.orderTypeTabs}>
              <TouchableOpacity
                style={[styles.orderTypeBtn, orderType === 'MARKET' && styles.orderTypeBtnActive]}
                onPress={() => setOrderType('MARKET')}
              >
                <Text style={[styles.orderTypeText, orderType === 'MARKET' && styles.orderTypeTextActive]}>Piyasa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.orderTypeBtn, orderType === 'LIMIT' && styles.orderTypeBtnActive]}
                onPress={() => {
                  setOrderType('LIMIT');
                  if (!limitPrice) setLimitPrice(currentPrice.toFixed(2));
                }}
              >
                <Text style={[styles.orderTypeText, orderType === 'LIMIT' && styles.orderTypeTextActive]}>Limit</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Long / Short Yön Butonları */}
          <View style={styles.sideToggleRow}>
            <TouchableOpacity
              style={[styles.sideToggleBtn, side === 'LONG' ? styles.sideToggleLongActive : styles.sideToggleInactive]}
              onPress={() => setSide('LONG')}
            >
              <Text style={[styles.sideToggleText, side === 'LONG' && styles.sideToggleTextActive]}>
                Al / Long
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sideToggleBtn, side === 'SHORT' ? styles.sideToggleShortActive : styles.sideToggleInactive]}
              onPress={() => setSide('SHORT')}
            >
              <Text style={[styles.sideToggleText, side === 'SHORT' && styles.sideToggleTextActive]}>
                Sat / Short
              </Text>
            </TouchableOpacity>
          </View>

          {/* Limit Fiyat Girişi (Limit seçiliyse) */}
          {orderType === 'LIMIT' && (
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Fiyat (USDT)</Text>
              <TextInput
                style={styles.formInput}
                keyboardType="numeric"
                value={limitPrice}
                onChangeText={setLimitPrice}
                placeholder="0.00"
                placeholderTextColor="#5e6673"
              />
            </View>
          )}

          {/* İşlem Marjı [Para Birimi] Girişi */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputHeaderRow}>
              <Text style={styles.inputLabel}>
                İşlem Marjı [{currency === 'TRY' ? '₺ TRY' : '$ USD'}]
              </Text>
              <Text style={styles.inputSubLabel}>
                Maks: {formatMoney(availableInSelectedCurrency)}
              </Text>
            </View>
            <View style={styles.marginInputBox}>
              <Text style={styles.marginInputPrefix}>{currencySymbol}</Text>
              <TextInput
                style={styles.marginTextInput}
                keyboardType="numeric"
                value={marginInput}
                onChangeText={setMarginInput}
                placeholder={currency === 'TRY' ? '1000' : '100'}
                placeholderTextColor="#5e6673"
              />
            </View>
          </View>

          {/* Hızlı Yüzde Butonları */}
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
              color={isTpSlEnabled ? '#f0b90b' : '#848e9c'}
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
              {/* Kâr Al (TP) */}
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
                  placeholder={`Örn: ${formatPricePrecision(executionPrice * (side === 'LONG' ? 1.05 : 0.95))}`}
                  placeholderTextColor="#5e6673"
                />
              </View>

              {/* Zarar Durdur (SL) */}
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
                  placeholder={`Örn: ${formatPricePrecision(executionPrice * (side === 'LONG' ? 0.95 : 1.05))}`}
                  placeholderTextColor="#5e6673"
                />
              </View>
            </View>
          )}

          {/* Maliyet ve Risk Bilgi Tablosu */}
          <View style={styles.costInfoCard}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Pozisyon Hacmi:</Text>
              <Text style={[styles.costValue, { color: '#eaecef' }]}>
                {formatMoney(positionVolumeSelected)}{' '}
                <Text style={styles.costSubValue}>(~${positionVolumeUsd.toFixed(2)})</Text>
              </Text>
            </View>

            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Coin Miktarı:</Text>
              <Text style={[styles.costValue, { color: '#f0b90b' }]}>
                {coinQuantity.toFixed(4)} {selectedPair.baseAsset}
              </Text>
            </View>

            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Tahmini Likidasyon (İzole):</Text>
              <Text style={[styles.costValue, { color: estLiquidation > 0 ? '#f6465d' : '#848e9c' }]}>
                {estLiquidation === 0 ? '-- (Risk Yok)' : `$${estLiquidation.toFixed(2)}`}
              </Text>
            </View>

            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Tahmini Komisyon (%0.05):</Text>
              <Text style={styles.costValue}>
                {formatMoney(estimatedFeeSelected)}{' '}
                <Text style={styles.costSubValue}>(~${(estimatedFeeSelected / rate).toFixed(3)})</Text>
              </Text>
            </View>
          </View>

          {/* Ana Emir Gönderme Butonu */}
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

      {/* 6. MOD SEÇİM MODALI (Alt Alta İki Kutu) */}
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
                <Ionicons name="swap-horizontal" size={18} color="#f0b90b" />
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
              style={[styles.modeCard, styles.modeCardFreeActive]}
              onPress={() => {
                setActiveMode('FREE');
                setShowModeModal(false);
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
                      <Text style={[styles.modeCardBadgeText, { color: '#f0b90b' }]}>Aktif</Text>
                    </View>
                  </View>
                  <Text style={styles.modeCardDesc}>
                    Belirtilen miktar ve birim ile serbestçe trade yapabilmek aynı zamanda istendiği vakit para birimi değişikliği veya kur çevirimi olabiliyor.
                  </Text>
                  <Text style={styles.modeCardMeta}>
                    {hasCustomBalance
                      ? `Bakiye: ${currencySymbol}${availableInSelectedCurrency.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
                      : 'Bakiye: Henüz Başlatılmadı (Girişte Seçilecek)'}
                  </Text>
                </View>
              </View>
              <Ionicons name="checkmark-circle" size={22} color="#f0b90b" />
            </TouchableOpacity>

            {/* KUTU 2: Trade (Challenge Mod) */}
            <TouchableOpacity
              style={[styles.modeCard, styles.modeCardChallengeInactive]}
              onPress={() => {
                setShowModeModal(false);
                setTimeout(() => {
                  setActiveMode('CHALLENGE');
                  router.replace('/challenge');
                }, 50);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.modeCardLeft}>
                <View style={[styles.modeCardIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="trophy" size={22} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.modeCardTitleRow}>
                    <Text style={[styles.modeCardTitle, { color: '#60a5fa' }]}>Trade (Challenge Mod)</Text>
                    <View style={[styles.modeCardBadge, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                      <Text style={[styles.modeCardBadgeText, { color: '#60a5fa' }]}>Katlama Modu</Text>
                    </View>
                  </View>
                  <Text style={styles.modeCardDesc}>
                    Başta kullanıcı tarafından girilen miktarı katlama amacı taşır ve başta belirtilen para birimi ile devam edilir dönüşüm olmaz.
                  </Text>
                  <Text style={styles.modeCardMeta}>
                    {challenge?.isConfigured
                      ? `Bakiye: ${(challenge?.currency || 'TRY') === 'TRY' ? '₺' : '$'}${challenge.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${challenge.currency || 'TRY'}`
                      : 'Bakiye: Henüz Başlatılmadı (Girişte Seçilecek)'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#848e9c" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CÜZDAN SIFIRLAMA 1. ADIM: ÖZEL ŞIK ONAY MODALI (Alert yerine) */}
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
            {/* Üst İkon & Başlık */}
            <View style={styles.resetConfirmTopRow}>
              <View style={styles.resetConfirmIconCircle}>
                <Ionicons name="reload" size={22} color="#f0b90b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resetConfirmTitle}>Cüzdanı Sıfırla</Text>
                <Text style={styles.resetConfirmSub}>Serbest Mod Hesap Bakiyesi</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowResetConfirmModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            {/* Bilgilendirme / Uyarı Kutusu */}
            <View style={styles.resetConfirmNoticeBox}>
              <Ionicons name="alert-circle-outline" size={22} color="#f59e0b" style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resetConfirmNoticeTitle}>Dikkat Edilmesi Gerekenler:</Text>
                <Text style={styles.resetConfirmNoticeText}>
                  • Varsa tüm açık pozisyonlarınız, işlem geçmişiniz, portföy ve performans verileriniz sıfırlanacak.
                </Text>
                <Text style={styles.resetConfirmNoticeText}>
                  • Bir sonraki ekranda cüzdanınız için yeni para birimi (₺ / $) ve başlangıç bakiyesi belirleyebileceksiniz.
                </Text>
              </View>
            </View>

            {/* Butonlar: Vazgeç & Evet, Sıfırla */}
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
                  setResetCurrency(currency);
                  setResetCustomAmount(currency === 'TRY' ? '500000' : '10000');
                  setShowResetModal(true);
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
                <Text style={styles.insufficientSub}>İşlem için gereken marjin bakiyenizden fazla</Text>
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
                  {formatMoney(marginNum)}
                </Text>
              </View>
              <View style={styles.insufficientDivider} />
              <View style={styles.insufficientDetailRow}>
                <Text style={styles.insufficientDetailLabel}>Kullanılabilir Bakiye</Text>
                <Text style={[styles.insufficientDetailValue, { color: '#0ecb81' }]}>
                  {formatMoney(availableInSelectedCurrency)}
                </Text>
              </View>
              <View style={styles.insufficientDivider} />
              <View style={styles.insufficientDetailRow}>
                <Text style={styles.insufficientDetailLabel}>Eksik Tutar</Text>
                <Text style={[styles.insufficientDetailValue, { color: '#f6465d', fontWeight: 'bold' }]}>
                  {formatMoney(Math.max(0, marginNum - availableInSelectedCurrency))}
                </Text>
              </View>
            </View>

            {/* İpucu Kutusu */}
            <View style={styles.insufficientTipBox}>
              <Ionicons name="information-circle-outline" size={18} color="#f0b90b" style={{ marginTop: 1 }} />
              <Text style={styles.insufficientTipText}>
                İşlem tutarını düşürebilir, kaldıracı artırarak gereken marjini azaltabilir veya serbest mod cüzdanınızı yeniden yüklemek için sıfırlayabilirsiniz.
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
                style={styles.insufficientActionBtn}
                onPress={() => {
                  setShowInsufficientBalanceModal(false);
                  setShowResetConfirmModal(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="reload" size={15} color="#0b0e11" style={{ marginRight: 4 }} />
                <Text style={styles.insufficientActionText}>Cüzdanı Sıfırla</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CÜZDAN SIFIRLAMA 2. ADIM: PARA BİRİMİ VE MİKTAR SEÇİM MODALI */}
      <Modal
        visible={showResetModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (hasCustomBalance) setShowResetModal(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (hasCustomBalance) setShowResetModal(false);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.resetModalCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.modeModalHeader}>
              <View style={styles.modeModalTitleRow}>
                <Ionicons name="wallet-outline" size={22} color="#f0b90b" />
                <Text style={styles.modeModalTitle}>
                  {!hasCustomBalance ? 'Hoş Geldiniz! 🚀' : 'Para Birimi ve Bakiye Belirle'}
                </Text>
              </View>
              {hasCustomBalance && (
                <TouchableOpacity onPress={() => setShowResetModal(false)}>
                  <Ionicons name="close" size={20} color="#848e9c" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.modeModalSub}>
              {!hasCustomBalance
                ? 'Simülasyona başlamak için para birimi ve başlangıç bakiyenizi belirleyin:'
                : 'Cüzdanınız için yeni para birimi ve başlangıç bakiyesini seçin:'}
            </Text>

            {/* Para Birimi Seçimi */}
            <Text style={styles.resetSectionLabel}>1. Para Birimi Seçin</Text>
            <View style={styles.resetCurrencyRow}>
              <TouchableOpacity
                style={[styles.resetCurrencyBtn, resetCurrency === 'TRY' && styles.resetCurrencyBtnActive]}
                onPress={() => {
                  setResetCurrency('TRY');
                  setResetCustomAmount('500000');
                }}
              >
                <Text style={[styles.resetCurrencyText, resetCurrency === 'TRY' && styles.resetCurrencyTextActive]}>
                  ₺ Türk Lirası (TRY)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.resetCurrencyBtn, resetCurrency === 'USD' && styles.resetCurrencyBtnActive]}
                onPress={() => {
                  setResetCurrency('USD');
                  setResetCustomAmount('10000');
                }}
              >
                <Text style={[styles.resetCurrencyText, resetCurrency === 'USD' && styles.resetCurrencyTextActive]}>
                  $ Amerikan Doları (USD)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Önerilen Tutarlar */}
            <Text style={styles.resetSectionLabel}>2. Önerilen Başlangıç Tutarları</Text>
            <View style={styles.resetPillsGrid}>
              {(resetCurrency === 'TRY'
                ? [50000, 100000, 250000, 500000, 1000000]
                : [1000, 5000, 10000, 25000, 50000]
              ).map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.resetPillBtn,
                    resetCustomAmount === amt.toString() && styles.resetPillBtnActive,
                  ]}
                  onPress={() => setResetCustomAmount(amt.toString())}
                >
                  <Text
                    style={[
                      styles.resetPillText,
                      resetCustomAmount === amt.toString() && styles.resetPillTextActive,
                    ]}
                  >
                    {resetCurrency === 'TRY' ? '₺' : '$'}
                    {amt.toLocaleString('tr-TR')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Özel Tutar Girişi */}
            <Text style={styles.resetSectionLabel}>Veya Özel Tutar Girin</Text>
            <View style={styles.customAmountInputWrapper}>
              <Text style={styles.customAmountCurrencyPrefix}>
                {resetCurrency === 'TRY' ? '₺' : '$'}
              </Text>
              <TextInput
                style={styles.customAmountInput}
                keyboardType="numeric"
                value={resetCustomAmount}
                onChangeText={setResetCustomAmount}
                placeholder="Eklenecek Özel Bakiye"
                placeholderTextColor="#5e6673"
              />
            </View>

            {/* Onayla Butonu */}
            <TouchableOpacity
              style={styles.confirmResetBtn}
              onPress={() => handleConfirmReset(parseFloat(resetCustomAmount || '0'), resetCurrency)}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmResetBtnText}>
                {!hasCustomBalance ? 'Cüzdanı Oluştur ve Başlat 🚀' : 'Cüzdanı Sıfırla ve Başlat'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* CÜZDAN SIFIRLANDI / OLUŞTURULDU BAŞARI MODALI (ÖZEL TASARIM & ORTALANMIŞ) */}
      <Modal
        visible={!!walletResetSuccessData}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletResetSuccessData(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setWalletResetSuccessData(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.walletResetSuccessCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            {/* Üst İkon Rozeti */}
            <View style={styles.walletResetSuccessBadge}>
              <View style={styles.walletResetSuccessIconCircle}>
                <Ionicons name="wallet" size={38} color="#f0b90b" />
              </View>
            </View>

            <Text style={styles.walletResetSuccessTitle}>
              {walletResetSuccessData?.isFirstTime ? 'Hesap Oluşturuldu! 🚀' : 'Cüzdan Sıfırlandı! 🚀'}
            </Text>
            <Text style={styles.walletResetSuccessSubtitle}>
              Serbest mod hesabınız başarıyla yapılandırıldı. Yeni bakiyenizle serbestçe işlem yapmaya başlayabilirsiniz!
            </Text>

            {/* Bilgi / Özet Kutusu */}
            <View style={styles.walletResetSuccessSummaryBox}>
              <View style={styles.walletResetSuccessRow}>
                <Text style={styles.walletResetSuccessLabel}>Yeni Bakiye</Text>
                <Text style={styles.walletResetSuccessVal}>
                  {walletResetSuccessData?.currency === 'TRY' ? '₺' : '$'}
                  {walletResetSuccessData?.amount.toLocaleString('tr-TR')}
                </Text>
              </View>

              <View style={styles.walletResetSuccessRowDivider} />

              <View style={styles.walletResetSuccessRow}>
                <Text style={styles.walletResetSuccessLabel}>Para Birimi</Text>
                <Text style={styles.walletResetCurrencyVal}>
                  {walletResetSuccessData?.currency === 'TRY' ? '₺ Türk Lirası (TRY)' : '$ Amerikan Doları (USD)'}
                </Text>
              </View>

              <View style={styles.walletResetSuccessRowDivider} />

              <View style={styles.walletResetSuccessRow}>
                <Text style={styles.walletResetSuccessLabel}>Aktif Mod</Text>
                <View style={styles.walletResetModeBadge}>
                  <Text style={styles.walletResetModeBadgeText}>Serbest Mod</Text>
                </View>
              </View>
            </View>

            {/* Bilgilendirme Kutusu */}
            <View style={styles.walletResetHintBox}>
              <Ionicons name="information-circle" size={16} color="#f0b90b" style={{ marginRight: 6 }} />
              <Text style={styles.walletResetHintText}>
                İstediğiniz an cüzdanınızı yeniden sıfırlayabilir veya para birimini değiştirebilirsiniz.
              </Text>
            </View>

            {/* İşlemlere Başla Butonu */}
            <TouchableOpacity
              style={styles.walletResetActionBtn}
              onPress={() => setWalletResetSuccessData(null)}
              activeOpacity={0.85}
            >
              <Ionicons name="rocket-sharp" size={18} color="#0b0e11" style={{ marginRight: 8 }} />
              <Text style={styles.walletResetActionBtnText}>İşlemlere Başla</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 7. PARİTE SEÇİM MODALI */}
      <Modal
        visible={showPairModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowPairModal(false);
          setPairSearchQuery('');
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowPairModal(false);
            setPairSearchQuery('');
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.pairModalCard}
            onPress={(e) => e.stopPropagation?.()}
          >
            <View style={styles.pairModalHeader}>
              <View style={styles.pairModalTitleRow}>
                <Ionicons name="swap-vertical" size={18} color="#f0b90b" />
                <Text style={styles.modalTitle}>Vadeli Kripto Pariteleri</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowPairModal(false);
                  setPairSearchQuery('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            {/* ARAMA ÇUBUĞU */}
            <View style={styles.pairSearchBox}>
              <Ionicons name="search" size={16} color="#848e9c" />
              <TextInput
                style={styles.pairSearchInput}
                placeholder="Coin veya harf girin (örn: B, SOL, ETH...)"
                placeholderTextColor="#5e6673"
                value={pairSearchQuery}
                onChangeText={setPairSearchQuery}
                autoCapitalize="characters"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {pairSearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setPairSearchQuery('')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={16} color="#848e9c" />
                </TouchableOpacity>
              )}
            </View>

            {/* Arama İpucu & Sayı */}
            <View style={styles.pairListHeaderRow}>
              <Text style={styles.pairListCountText}>
                {filteredPairs.length} Parite Listeleniyor
              </Text>
              {pairSearchQuery.length > 0 && (
                <Text style={styles.pairListFilterHint}>
                  "{pairSearchQuery.toUpperCase()}" ile başlayanlar üstte
                </Text>
              )}
            </View>

            <FlatList
              data={filteredPairs}
              keyExtractor={(item) => item.symbol}
              style={styles.pairFlatList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              initialNumToRender={20}
              maxToRenderPerBatch={25}
              windowSize={10}
              renderItem={({ item: pair }) => (
                <TouchableOpacity
                  style={[
                    styles.pairModalItem,
                    pair.symbol === selectedPair.symbol && styles.pairModalItemActive,
                  ]}
                  onPress={() => {
                    handleSelectPair(pair);
                    setPairSearchQuery('');
                  }}
                  activeOpacity={0.7}
                >
                  <View>
                    <View style={styles.pairItemNameRow}>
                      <Text style={styles.pairModalSymbol}>{pair.name}</Text>
                      <View style={styles.perpSmallBadge}>
                        <Text style={styles.perpSmallBadgeText}>Perp</Text>
                      </View>
                    </View>
                    <Text style={styles.pairModalSub}>Binance USDT-M Vadeli</Text>
                  </View>
                  <Ionicons
                    name={pair.symbol === selectedPair.symbol ? 'checkmark-circle' : 'chevron-forward'}
                    size={18}
                    color={pair.symbol === selectedPair.symbol ? '#f0b90b' : '#5e6673'}
                  />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.pairEmptyBox}>
                  <Ionicons name="search-outline" size={32} color="#5e6673" />
                  <Text style={styles.pairEmptyText}>
                    "{pairSearchQuery}" ile başlayan veya içeren coin bulunamadı.
                  </Text>
                </View>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 7. KALDIRAÇ AYAR MODALI */}
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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Kaldıraç Oranını Ayarla</Text>
              <TouchableOpacity onPress={() => setShowLeverageModal(false)}>
                <Ionicons name="close" size={20} color="#848e9c" />
              </TouchableOpacity>
            </View>

            <View style={styles.leverageDisplay}>
              <Text style={styles.leverageBigNumber}>{tempLeverage}x</Text>
              <Text style={styles.leverageRiskWarn}>
                {tempLeverage >= 50
                  ? '⚠️ Yüksek riskli kaldıraç seviyesi'
                  : 'Standart kaldıraç seviyesi'}
              </Text>
            </View>

            <View style={styles.leverageChipsGrid}>
              {[1, 5, 10, 20, 25, 50, 75, 100, 125].map((lev) => (
                <TouchableOpacity
                  key={lev}
                  style={[
                    styles.leverageChip,
                    tempLeverage === lev && styles.leverageChipActive,
                  ]}
                  onPress={() => setTempLeverage(lev)}
                >
                  <Text
                    style={[
                      styles.leverageChipText,
                      tempLeverage === lev && styles.leverageChipTextActive,
                    ]}
                  >
                    {lev}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.leverageConfirmBtn}
              onPress={() => {
                setLeverage(tempLeverage);
                setShowLeverageModal(false);
              }}
            >
              <Text style={styles.leverageConfirmBtnText}>Kaldıracı Onayla ({tempLeverage}x)</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 3 Saniyelik Otomatik Kapanan İşlem Başarı Bildirimi (Toast) */}
      {orderToast && (
        <Animated.View
          style={[
            styles.orderToastContainer,
            {
              top: insets.top ? insets.top + 2 : 36,
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-40, 0],
                  }),
                },
                {
                  scale: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[
              styles.orderToastCard,
              orderToast.side === 'LONG' ? styles.orderToastCardLong : styles.orderToastCardShort,
            ]}
            activeOpacity={0.9}
            onPress={dismissToast}
          >
            <View
              style={[
                styles.orderToastIconCircle,
                orderToast.side === 'LONG' ? styles.toastIconCircleLong : styles.toastIconCircleShort,
              ]}
            >
              <Ionicons
                name={orderToast.side === 'LONG' ? 'trending-up' : 'trending-down'}
                size={22}
                color={orderToast.side === 'LONG' ? '#0ecb81' : '#f6465d'}
              />
            </View>

            <View style={styles.orderToastTextWrap}>
              <View style={styles.orderToastHeaderRow}>
                <Text style={styles.orderToastTitle}>Emir Başarıyla Gerçekleşti</Text>
                <View
                  style={[
                    styles.orderToastSideBadge,
                    orderToast.side === 'LONG' ? styles.toastSideBadgeLong : styles.toastSideBadgeShort,
                  ]}
                >
                  <Text
                    style={[
                      styles.orderToastSideText,
                      orderToast.side === 'LONG' ? styles.toastSideTextLong : styles.toastSideTextShort,
                    ]}
                  >
                    {orderToast.side} {orderToast.leverage}x
                  </Text>
                </View>
              </View>
              <Text style={styles.orderToastSub}>
                {orderToast.symbol} pozisyonunuz açıldı
              </Text>
            </View>

            <TouchableOpacity
              style={styles.orderToastCloseBtn}
              onPress={dismissToast}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color="#848e9c" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0e11',
  },
  header: {
    backgroundColor: '#181a20',
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2b313a',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    gap: 6,
    backgroundColor: '#2b313a',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  modePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(240, 185, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.35)',
  },
  modePickerBtnText: {
    color: '#f0b90b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  pairIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pairPickerTitle: {
    color: '#eaecef',
    fontSize: 16,
    fontWeight: 'bold',
  },
  perpTag: {
    backgroundColor: '#3b404a',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  perpTagText: {
    color: '#848e9c',
    fontSize: 10,
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
    backgroundColor: '#20252b',
    borderWidth: 1,
    borderColor: '#2b313a',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // En Üst Satırın Hemen Altı: Toplam Tutar, Kullanılabilir Bakiye, Para Birimi Seçimi
  balanceCurrencyBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#20252b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  balanceBarCol: {
    justifyContent: 'center',
  },
  balanceBarLabel: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  balanceBarValue: {
    color: '#eaecef',
    fontSize: 12,
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
  currencyToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#181a20',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  currencyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  currencyPillActive: {
    backgroundColor: '#f0b90b',
  },
  currencyPillText: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: 'bold',
  },
  currencyPillTextActive: {
    color: '#0b0e11',
    fontWeight: 'bold',
  },

  // Global Kripto Piyasası (CoinMarketCap)
  globalMarketBar: {
    marginBottom: 6,
  },
  globalMarketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  globalMarketTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  globalMarketTitle: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  cmcBadge: {
    backgroundColor: 'rgba(56, 97, 251, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 97, 251, 0.35)',
  },
  cmcBadgeText: {
    color: '#3861fb',
    fontSize: 9,
    fontWeight: 'bold',
  },
  metricsStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  metricCard: {
    backgroundColor: '#20252b',
    borderRadius: 8,
    padding: 8,
    width: 156,
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  metricCardTitle: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
  },
  metricCardValue: {
    color: '#eaecef',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  metricCardSub: {
    color: '#848e9c',
    fontSize: 9,
    fontWeight: '500',
  },

  // Serbest Mod Bakiyeye Para Ekle Kartı
  depositBoxCard: {
    backgroundColor: '#181a20',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  depositBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  depositBoxIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositBoxTitle: {
    color: '#eaecef',
    fontSize: 13,
    fontWeight: 'bold',
  },
  depositBoxSub: {
    color: '#848e9c',
    fontSize: 11,
    marginTop: 2,
  },
  depositPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  depositPresetBtn: {
    backgroundColor: '#20252b',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b313a',
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
    backgroundColor: '#20252b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b313a',
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
    color: '#eaecef',
    fontSize: 13,
    paddingVertical: 8,
    fontWeight: '600',
  },
  depositSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0b90b',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
  },
  depositSubmitBtnText: {
    color: '#0b0e11',
    fontSize: 12,
    fontWeight: 'bold',
  },
  quickNavWalletText: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tickerStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },
  livePriceText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  changePercentText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
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
    marginTop: 2,
  },

  mainScrollView: {
    flex: 1,
  },
  timeframeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#181a20',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2b313a',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  timeframeScroll: {
    flex: 1,
    marginRight: 6,
  },
  timeframeList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  timeframeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 4,
  },
  timeframeBtnActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
  },
  timeframeText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: '600',
  },
  timeframeTextActive: {
    color: '#f0b90b',
    fontWeight: 'bold',
  },
  rulerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#20252b',
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  rulerBtnActive: {
    backgroundColor: '#f0b90b',
    borderColor: '#f0b90b',
  },
  rulerBtnText: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rulerBtnTextActive: {
    color: '#0b0e11',
  },
  chartToolbarRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  toolbarToolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#20252b',
    borderWidth: 1,
    borderColor: '#2b313a',
    flexShrink: 0,
  },
  toolbarToolBtnActive: {
    backgroundColor: '#f0b90b',
    borderColor: '#f0b90b',
  },
  toolbarToolBtnText: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: 'bold',
  },
  toolbarToolBtnTextActive: {
    color: '#0b0e11',
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
  chartFloatingZoomBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 24, 30, 0.90)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b313a',
    paddingHorizontal: 4,
    paddingVertical: 3,
    gap: 4,
    elevation: 5,
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
    backgroundColor: '#2b313a',
    borderRadius: 4,
  },
  floatingZoomLabelBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingZoomLabelText: {
    color: '#f0b90b',
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
    backgroundColor: 'rgba(16, 20, 26, 0.96)',
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
    backgroundColor: '#20252b',
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
    backgroundColor: 'rgba(32, 37, 43, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2b313a',
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
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0ecb81',
    marginLeft: 3,
  },
  rulerTagLabel: {
    color: '#848e9c',
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
    zIndex: 60,
  },
  rulerHelpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(11, 14, 20, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rulerHelpText: {
    color: '#eaecef',
    fontSize: 10,
    fontWeight: '600',
  },
  chartContainer: {
    height: CHART_HEIGHT,
    backgroundColor: '#0b0e14',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1e2329',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  marginInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20252b',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b313a',
    paddingHorizontal: 10,
  },
  marginInputPrefix: {
    color: '#f0b90b',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 6,
  },
  marginTextInput: {
    flex: 1,
    color: '#eaecef',
    fontSize: 15,
    fontWeight: 'bold',
    paddingVertical: 10,
  },
  costSubValue: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: 'normal',
  },

  // Segment
  viewSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#181a20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2b313a',
    gap: 8,
  },
  viewSegmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#20252b',
  },
  viewSegmentActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f0b90b',
  },
  viewSegmentText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: '600',
  },
  viewSegmentTextActive: {
    color: '#f0b90b',
    fontWeight: 'bold',
  },

  // Görsel Bölüm
  visualSection: {
    backgroundColor: '#0b0e11',
    borderBottomWidth: 1,
    borderBottomColor: '#2b313a',
  },
  chartBox: {
    height: 320,
    backgroundColor: '#0b0e11',
  },

  // Emir Defteri
  orderBookCard: {
    backgroundColor: '#12161c',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#20252b',
  },
  orderBookHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  obHeadCol: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: 'bold',
  },
  obList: {
    gap: 3,
  },
  obRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  depthBarAsk: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(246, 70, 93, 0.12)',
  },
  depthBarBid: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(14, 203, 129, 0.12)',
  },
  obPriceAsk: {
    color: '#f6465d',
    fontSize: 12,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  obPriceBid: {
    color: '#0ecb81',
    fontSize: 12,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  obAmount: {
    color: '#848e9c',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  obCenterPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginVertical: 4,
    backgroundColor: '#181a20',
    borderRadius: 4,
  },
  obCenterPrice: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  obSpreadText: {
    color: '#848e9c',
    fontSize: 10,
  },

  // Emir Form Paneli
  orderPanel: {
    backgroundColor: '#181a20',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2b313a',
  },
  marginLeverageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2b313a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  controlPillText: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: '600',
  },
  orderTypeTabs: {
    flexDirection: 'row',
    marginLeft: 'auto',
    backgroundColor: '#20252b',
    borderRadius: 4,
    padding: 2,
  },
  orderTypeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 3,
  },
  orderTypeBtnActive: {
    backgroundColor: '#2b313a',
  },
  orderTypeText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: '600',
  },
  orderTypeTextActive: {
    color: '#eaecef',
    fontWeight: 'bold',
  },

  sideToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sideToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideToggleLongActive: {
    backgroundColor: '#0ecb81',
  },
  sideToggleShortActive: {
    backgroundColor: '#f6465d',
  },
  sideToggleInactive: {
    backgroundColor: '#2b313a',
  },
  sideToggleText: {
    color: '#848e9c',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sideToggleTextActive: {
    color: '#ffffff',
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
    marginBottom: 4,
  },
  inputSubLabel: {
    color: '#848e9c',
    fontSize: 11,
  },
  formInput: {
    backgroundColor: '#20252b',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#eaecef',
    fontSize: 16,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2b313a',
  },

  quickPercentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  quickPercentBtn: {
    flex: 1,
    paddingVertical: 7,
    backgroundColor: '#2b313a',
    borderRadius: 4,
    alignItems: 'center',
  },
  quickPercentText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: 'bold',
  },

  // TP/SL
  tpSlToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#20252b',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b313a',
    marginBottom: 12,
  },
  tpSlToggleTitle: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tpSlToggleSub: {
    color: '#5e6673',
    fontSize: 10,
    marginTop: 2,
  },
  tpSlExpandedContainer: {
    backgroundColor: '#20252b',
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b313a',
    marginBottom: 12,
    gap: 12,
  },
  tpSlInputGroup: {
    gap: 6,
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
    alignItems: 'center',
    gap: 4,
  },
  quickPillBtn: {
    backgroundColor: '#2b313a',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  quickPillText: {
    color: '#848e9c',
    fontSize: 10,
    fontWeight: '600',
  },

  costInfoCard: {
    backgroundColor: '#20252b',
    padding: 12,
    borderRadius: 6,
    gap: 6,
    marginBottom: 14,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  costLabel: {
    color: '#848e9c',
    fontSize: 11,
  },
  costValue: {
    color: '#eaecef',
    fontSize: 11,
    fontWeight: '600',
  },

  mainOrderBtn: {
    paddingVertical: 14,
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
    fontSize: 15,
    fontWeight: 'bold',
  },

  // Modallar
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  // Mod Seçim Modalı Stilleri
  modeModalContent: {
    backgroundColor: '#181a20',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#2b313a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },
  modeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modeModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeModalTitle: {
    color: '#eaecef',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modeModalSub: {
    color: '#848e9c',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 16,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  modeCardFreeActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.08)',
    borderColor: '#f0b90b',
  },
  modeCardFreeInactive: {
    backgroundColor: '#20252b',
    borderColor: '#2b313a',
  },
  modeCardChallengeActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: '#3b82f6',
  },
  modeCardChallengeInactive: {
    backgroundColor: '#20252b',
    borderColor: '#2b313a',
  },
  modeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  modeCardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  modeCardTitle: {
    fontSize: 13,
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
    color: '#848e9c',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 4,
  },
  modeCardMeta: {
    color: '#eaecef',
    fontSize: 10,
    fontWeight: '600',
  },

  // Cüzdan Sıfırlama 1. Adım Onay Modalı Stilleri
  resetConfirmCard: {
    backgroundColor: '#181a20',
    borderRadius: 18,
    padding: 20,
    width: '92%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.35)',
    shadowColor: '#f0b90b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  resetConfirmTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  resetConfirmIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(240, 185, 11, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.3)',
  },
  resetConfirmTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  resetConfirmSub: {
    color: '#848e9c',
    fontSize: 12,
    marginTop: 2,
  },
  resetConfirmNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginBottom: 18,
  },
  resetConfirmNoticeTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resetConfirmNoticeText: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 18,
  },
  resetConfirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  resetConfirmCancelBtn: {
    flex: 1,
    backgroundColor: '#20252b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  resetConfirmCancelText: {
    color: '#94a3b8',
    fontSize: 13.5,
    fontWeight: '700',
  },
  resetConfirmProceedBtn: {
    flex: 1.3,
    backgroundColor: '#f0b90b',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  resetConfirmProceedText: {
    color: '#0b0e11',
    fontSize: 13.5,
    fontWeight: 'bold',
  },

  // Cüzdan Sıfırlama Modalı Stilleri
  resetModalCard: {
    backgroundColor: '#181a20',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  resetSectionLabel: {
    color: '#eaecef',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  resetCurrencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resetCurrencyBtn: {
    flex: 1,
    backgroundColor: '#20252b',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2b313a',
    alignItems: 'center',
  },
  resetCurrencyBtnActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    borderColor: '#f0b90b',
  },
  resetCurrencyText: {
    color: '#848e9c',
    fontSize: 12,
    fontWeight: '600',
  },
  resetCurrencyTextActive: {
    color: '#f0b90b',
    fontWeight: 'bold',
  },
  resetPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  resetPillBtn: {
    backgroundColor: '#20252b',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  resetPillBtnActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.2)',
    borderColor: '#f0b90b',
  },
  resetPillText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: 'bold',
  },
  resetPillTextActive: {
    color: '#f0b90b',
  },
  customAmountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#20252b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2b313a',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  customAmountCurrencyPrefix: {
    color: '#f0b90b',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  customAmountInput: {
    flex: 1,
    color: '#eaecef',
    fontSize: 15,
    paddingVertical: 10,
    fontWeight: 'bold',
  },
  confirmResetBtn: {
    backgroundColor: '#f0b90b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmResetBtnText: {
    color: '#0b0e11',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalContent: {
    backgroundColor: '#1e2329',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2b313a',
  },
  pairModalCard: {
    backgroundColor: '#1e2329',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2b313a',
    width: '94%',
    maxWidth: 420,
    maxHeight: '80%',
  },
  pairModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pairModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pairSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14171a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2b313a',
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    marginBottom: 10,
    gap: 8,
  },
  pairSearchInput: {
    flex: 1,
    color: '#eaecef',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 2,
  },
  pairListHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  pairListCountText: {
    color: '#848e9c',
    fontSize: 11,
    fontWeight: '600',
  },
  pairListFilterHint: {
    color: '#f0b90b',
    fontSize: 11,
    fontWeight: '600',
  },
  pairFlatList: {
    maxHeight: 380,
  },
  pairItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  perpSmallBadge: {
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  perpSmallBadgeText: {
    color: '#f0b90b',
    fontSize: 9,
    fontWeight: 'bold',
  },
  pairEmptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pairEmptyText: {
    color: '#848e9c',
    fontSize: 13,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2b313a',
    paddingBottom: 10,
  },
  modalTitle: {
    color: '#eaecef',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pairModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2b313a',
  },
  pairModalItemActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.08)',
    borderRadius: 6,
  },
  pairModalSymbol: {
    color: '#eaecef',
    fontSize: 15,
    fontWeight: 'bold',
  },
  pairModalSub: {
    color: '#848e9c',
    fontSize: 11,
    marginTop: 2,
  },

  leverageDisplay: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  leverageBigNumber: {
    color: '#f0b90b',
    fontSize: 36,
    fontWeight: 'bold',
  },
  leverageRiskWarn: {
    color: '#848e9c',
    fontSize: 12,
    marginTop: 4,
  },
  leverageChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  leverageChip: {
    width: '30%',
    paddingVertical: 10,
    backgroundColor: '#2b313a',
    borderRadius: 6,
    alignItems: 'center',
  },
  leverageChipActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f0b90b',
  },
  leverageChipText: {
    color: '#eaecef',
    fontSize: 13,
    fontWeight: 'bold',
  },
  leverageChipTextActive: {
    color: '#f0b90b',
  },
  leverageConfirmBtn: {
    backgroundColor: '#f0b90b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  leverageConfirmBtnText: {
    color: '#0b0e11',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // 3 Saniyelik Otomatik Kapanan İşlem Başarı Bildirimi (Toast) Stilleri
  orderToastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  orderToastCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161a22',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 12,
  },
  orderToastCardLong: {
    borderColor: '#0ecb81',
  },
  orderToastCardShort: {
    borderColor: '#f6465d',
  },
  orderToastIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  toastIconCircleLong: {
    backgroundColor: 'rgba(14, 203, 129, 0.15)',
  },
  toastIconCircleShort: {
    backgroundColor: 'rgba(246, 70, 93, 0.15)',
  },
  orderToastTextWrap: {
    flex: 1,
  },
  orderToastHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderToastTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  orderToastSideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toastSideBadgeLong: {
    backgroundColor: 'rgba(14, 203, 129, 0.2)',
  },
  toastSideBadgeShort: {
    backgroundColor: 'rgba(246, 70, 93, 0.2)',
  },
  orderToastSideText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  toastSideTextLong: {
    color: '#0ecb81',
  },
  toastSideTextShort: {
    color: '#f6465d',
  },
  orderToastSub: {
    color: '#848e9c',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  orderToastCloseBtn: {
    padding: 6,
    marginLeft: 6,
  },

  // Yetersiz Bakiye Modal Stilleri
  insufficientModalCard: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#161a1e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2b313a',
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
    backgroundColor: '#0b0e11',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#20252b',
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
    backgroundColor: '#1b2028',
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
  insufficientTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(240, 185, 11, 0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.2)',
    marginBottom: 16,
  },
  insufficientTipText: {
    flex: 1,
    fontSize: 11,
    color: '#d1d5db',
    lineHeight: 16,
  },
  insufficientBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  insufficientCancelBtn: {
    flex: 1,
    backgroundColor: '#20252b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientCancelText: {
    color: '#eaecef',
    fontSize: 13,
    fontWeight: '600',
  },
  insufficientActionBtn: {
    flex: 1.3,
    backgroundColor: '#f0b90b',
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insufficientActionText: {
    color: '#0b0e11',
    fontSize: 13,
    fontWeight: '700',
  },

  // Cüzdan Sıfırlandı / Oluşturuldu Özel Ortalanmış Modal Stilleri
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  walletResetSuccessCard: {
    backgroundColor: '#181a20',
    width: '100%',
    maxWidth: 390,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.4)',
    alignItems: 'center',
    shadowColor: '#f0b90b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  walletResetSuccessBadge: {
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletResetSuccessIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(240, 185, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(240, 185, 11, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletResetSuccessTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  walletResetSuccessSubtitle: {
    fontSize: 12,
    color: '#848e9c',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  walletResetSuccessSummaryBox: {
    width: '100%',
    backgroundColor: '#12161c',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2b313a',
    marginBottom: 14,
  },
  walletResetSuccessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  walletResetSuccessRowDivider: {
    height: 1,
    backgroundColor: '#1e2329',
    marginVertical: 6,
  },
  walletResetSuccessLabel: {
    fontSize: 12,
    color: '#848e9c',
    fontWeight: '500',
  },
  walletResetSuccessVal: {
    fontSize: 15,
    color: '#f0b90b',
    fontWeight: 'bold',
  },
  walletResetCurrencyVal: {
    fontSize: 13,
    color: '#eaecef',
    fontWeight: '600',
  },
  walletResetModeBadge: {
    backgroundColor: 'rgba(240, 185, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  walletResetModeBadgeText: {
    fontSize: 11,
    color: '#f0b90b',
    fontWeight: 'bold',
  },
  walletResetHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240, 185, 11, 0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(240, 185, 11, 0.2)',
    marginBottom: 18,
    width: '100%',
  },
  walletResetHintText: {
    fontSize: 11,
    color: '#fcd34d',
    flex: 1,
    lineHeight: 15,
  },
  walletResetActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0b90b',
    paddingVertical: 13,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#f0b90b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  walletResetActionBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0b0e11',
  },
});