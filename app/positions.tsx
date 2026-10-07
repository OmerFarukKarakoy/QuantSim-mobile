import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchCurrentPrice, subscribeToMultiplePrices } from '../src/services/binance';
import { useTradeStore } from '../src/store/useTradeStore';
import { calculatePnL, calculateROE } from '../src/utils/math';

export default function PositionsScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'ORDERS' | 'ASSETS'>('POSITIONS');
  const {
    positions,
    challenge,
    balance,
    availableBalance,
    closePosition,
    closeChallengePosition,
    activeMode,
    setActiveMode,
    currency,
    usdTryRate,
    updateMarketPrice,
  } = useTradeStore();

  const isChallenge = activeMode === 'CHALLENGE';
  const currentPositions = isChallenge ? (challenge?.positions || []) : (positions || []);

  // Canlı WebSocket Fiyat Akışı (Anlık PnL ve Risk Değişimleri İçin)
  const activeSymbolsKey = useMemo(() => {
    return Array.from(new Set(currentPositions.map((p) => p.symbol))).sort().join(',');
  }, [currentPositions]);

  useEffect(() => {
    if (!activeSymbolsKey) return;
    const symbols = activeSymbolsKey.split(',');

    // 1. Sayfa açılır açılmaz anında güncel REST fiyatlarını al
    symbols.forEach((sym) => {
      fetchCurrentPrice(sym).then((price) => {
        if (price) {
          updateMarketPrice(sym, price);
        }
      });
    });

    // 2. Canlı WebSocket bağlantısını başlat (Hassas ve anlık değişimler için)
    const unsubscribe = subscribeToMultiplePrices(symbols, (sym, price) => {
      updateMarketPrice(sym, price);
    });

    return () => {
      unsubscribe();
    };
  }, [activeSymbolsKey, updateMarketPrice]);

  const displayCurrency = isChallenge ? (challenge?.currency || 'TRY') : currency;
  const currencySymbol = displayCurrency === 'TRY' ? '₺' : '$';
  const usdRate = usdTryRate > 0 ? usdTryRate : 34.85;
  // Challenge modunda bakiye ve marjin zaten challenge.currency cinsindedir; Serbest modda USD saklanır.
  const currencyRate = isChallenge ? 1 : (currency === 'TRY' ? usdRate : 1);
  // Kripto fiyatları (Binance USDT) seçili para birimine çevrilir
  const cryptoRate = displayCurrency === 'TRY' ? usdRate : 1;
  // PnL fonksiyonu USD cinsinden döner; TRY seçiliyse kura göre çevrilir
  const pnlRate = displayCurrency === 'TRY' ? usdRate : 1;
  const rate = cryptoRate;

  const activeMargin = currentPositions.reduce((acc, p) => acc + p.margin, 0);
  const currentBalance = isChallenge ? (challenge?.balance ?? 100000) : balance;
  const currentAvailable = isChallenge ? Math.max(0, (challenge?.balance ?? 100000) - activeMargin) : availableBalance;
  const totalUnrealizedPnL = currentPositions.reduce(
    (sum, pos) => sum + calculatePnL(pos.entryPrice, pos.currentPrice, pos.amount, pos.side) * pnlRate,
    0
  );

  // Standart para formatı
  const formatMoney = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Hassas Fiyat Formatı (küçük fiyatlı coinlerde ve anlık değişimlerde basamak kaybını önler)
  const formatPositionPrice = (val: number) => {
    const absVal = Math.abs(val);
    const decimals = absVal < 0.001 ? 6 : absVal < 1 ? 4 : absVal < 10 ? 3 : 2;
    return `${currencySymbol}${val.toLocaleString('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  };

  // Hassas PnL Tutarı Formatı
  const formatPnLAmount = (val: number) => {
    const absVal = Math.abs(val);
    const decimals = absVal === 0 ? 2 : absVal < 0.1 ? 4 : absVal < 1 ? 3 : 2;
    return `${currencySymbol}${val.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    })}`;
  };

  // Hassas PnL (ROE%) Yüzdesi Formatı
  const formatRoe = (val: number) => {
    const absVal = Math.abs(val);
    const decimals = absVal < 1 ? 3 : 2;
    return `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}%`;
  };

  const handleCloseAll = () => {
    Alert.alert(
      'Tüm Pozisyonları Kapat',
      'Açık olan tüm pozisyonlar mevcut piyasa fiyatından kapatılacak. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet, Hepsini Kapat',
          style: 'destructive',
          onPress: () => {
            currentPositions.forEach((pos) => {
              if (isChallenge) {
                closeChallengePosition(pos.id, pos.currentPrice, 'MANUAL');
              } else {
                closePosition(pos.id, pos.currentPrice, 'MANUAL');
              }
            });
          },
        },
      ]
    );
  };

  const [closingTargetPos, setClosingTargetPos] = useState<any | null>(null);

  const openCloseModal = (pos: any) => {
    setClosingTargetPos(pos);
  };

  const handleConfirmClose = () => {
    if (!closingTargetPos) return;
    const { id, currentPrice } = closingTargetPos;
    if (isChallenge) {
      closeChallengePosition(id, currentPrice, 'MANUAL');
    } else {
      closePosition(id, currentPrice, 'MANUAL');
    }
    setClosingTargetPos(null);
  };

  const [editingPos, setEditingPos] = useState<any | null>(null);
  const [tpInput, setTpInput] = useState('');
  const [slInput, setSlInput] = useState('');

  // 8s Fonlama Sayacı (08:00, 16:00, 00:00 UTC döngüsü)
  const [fundingTimer, setFundingTimer] = useState('02:50:11');
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const nextCycleHour = Math.ceil((utcHours + 0.001) / 8) * 8;
      const target = new Date(now);
      target.setUTCHours(nextCycleHour, 0, 0, 0);
      const diffMs = target.getTime() - now.getTime();
      if (diffMs > 0) {
        const totalSec = Math.floor(diffMs / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        setFundingTimer(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        );
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const openTpSlModal = (pos: any) => {
    setEditingPos(pos);
    setTpInput(pos.takeProfit ? pos.takeProfit.toString() : '');
    setSlInput(pos.stopLoss ? pos.stopLoss.toString() : '');
  };

  const handleSaveTpSl = () => {
    if (!editingPos) return;
    const parsedTp = tpInput.trim() ? parseFloat(tpInput.replace(',', '.')) : undefined;
    const parsedSl = slInput.trim() ? parseFloat(slInput.replace(',', '.')) : undefined;

    if (isChallenge) {
      useTradeStore.getState().updateChallengePositionTPSL(editingPos.id, parsedTp, parsedSl);
    } else {
      useTradeStore.getState().updatePositionTPSL(editingPos.id, parsedTp, parsedSl);
    }
    setEditingPos(null);
  };

  return (
    <View style={styles.container}>
      {/* Üst Bar: "Açık Pozisyonlar (Serbest)" başlığı kaldırıldı */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 2 }]}>
        <View style={styles.headerLeftInfo}>
          <Text style={styles.headerCount}>{currentPositions.length} Aktif Pozisyon</Text>
          {currentPositions.length > 0 && (
            <Text
              style={[
                styles.headerTotalPnl,
                { color: totalUnrealizedPnL >= 0 ? '#00c087' : '#f43f5e' },
              ]}
            >
              Toplam PnL: {totalUnrealizedPnL >= 0 ? '+' : ''}{formatPnLAmount(totalUnrealizedPnL)}
            </Text>
          )}
        </View>

        <View style={styles.headerActions}>
          {currentPositions.length > 0 && (
            <TouchableOpacity style={styles.closeAllBtn} onPress={handleCloseAll}>
              <Text style={styles.closeAllText}>Tümünü Kapat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3'lü Terminal Sekmeleri: Pozisyonlar, Açık Emirler, Varlıklar */}
      <View style={styles.tabSegmentBar}>
        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeTab === 'POSITIONS' && (isChallenge ? styles.tabSegmentBtnActiveChallenge : styles.tabSegmentBtnActive),
          ]}
          onPress={() => setActiveTab('POSITIONS')}
        >
          <Text
            style={[
              styles.tabSegmentText,
              activeTab === 'POSITIONS' && (isChallenge ? styles.tabSegmentTextActiveChallenge : styles.tabSegmentTextActive),
            ]}
          >
            Pozisyonlar ({currentPositions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeTab === 'ORDERS' && (isChallenge ? styles.tabSegmentBtnActiveChallenge : styles.tabSegmentBtnActive),
          ]}
          onPress={() => setActiveTab('ORDERS')}
        >
          <Text
            style={[
              styles.tabSegmentText,
              activeTab === 'ORDERS' && (isChallenge ? styles.tabSegmentTextActiveChallenge : styles.tabSegmentTextActive),
            ]}
          >
            Açık Emirler (0)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabSegmentBtn,
            activeTab === 'ASSETS' && (isChallenge ? styles.tabSegmentBtnActiveChallenge : styles.tabSegmentBtnActive),
          ]}
          onPress={() => setActiveTab('ASSETS')}
        >
          <Text
            style={[
              styles.tabSegmentText,
              activeTab === 'ASSETS' && (isChallenge ? styles.tabSegmentTextActiveChallenge : styles.tabSegmentTextActive),
            ]}
          >
            Varlıklar
          </Text>
        </TouchableOpacity>
      </View>

      {/* İçerik Alanı */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. SEKMELİ GÖRÜNÜM: POZİSYONLAR */}
        {activeTab === 'POSITIONS' && (
          currentPositions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="layers-outline" size={42} color="#64748b" />
              </View>
              <Text style={styles.emptyText}>Şu an açık pozisyonunuz bulunmuyor</Text>
              <Text style={styles.emptySubText}>
                Binance Testnet üzerinden dilediğiniz paritede Long veya Short pozisyon açabilirsiniz.
              </Text>

              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={() => router.push(isChallenge ? '/challenge' : '/')}
                activeOpacity={0.85}
              >
                <Ionicons name="trending-up" size={18} color="#070a0f" style={{ marginRight: 6 }} />
                <Text style={styles.emptyActionBtnText}>İşlem Ekranına Git</Text>
              </TouchableOpacity>
            </View>
          ) : (
            currentPositions.map((pos) => {
              const rawPnl = calculatePnL(pos.entryPrice, pos.currentPrice, pos.amount, pos.side);
              const pnl = rawPnl * pnlRate;
              const posMargin = isChallenge ? pos.margin : pos.margin * currencyRate;
              const roe = calculateROE(pnl, posMargin);
              const isProfit = pnl >= 0;

              // Fiyat Değişim Yüzdesi (Giriş ile Anlık Arası)
              const priceChangePct = pos.entryPrice > 0 
                ? ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100 
                : 0;

              // Pozisyon Hacmi (Notional Size)
              const positionVolume = pos.currentPrice * pos.amount * cryptoRate;

              // Likidasyona Mesafe
              const distToLiq = pos.liquidationPrice > 0 
                ? Math.abs(pos.currentPrice - pos.liquidationPrice) 
                : 0;

              // Gerçekçi İzole Marjin Oranı (Binance Futures Standartı)
              const maintenanceMargin = positionVolume * 0.005;
              const marginBalance = posMargin + pnl;

              let marginRatio = 0;
              if (pos.liquidationPrice <= 0) {
                marginRatio = 0.5;
              } else if (marginBalance <= maintenanceMargin) {
                marginRatio = 99.9;
              } else {
                marginRatio = (maintenanceMargin / marginBalance) * 100;
                marginRatio = Math.min(99.9, Math.max(0.5, marginRatio));
              }

              const riskLevel = marginRatio > 65 ? 'YÜKSEK' : marginRatio > 35 ? 'ORTA' : 'DÜŞÜK';
              const riskColor = marginRatio > 65 ? '#f43f5e' : marginRatio > 35 ? '#f59e0b' : '#00c087';

              // Fonlama Oranı ve Ücreti (+0.0100% standart periyot)
              const fundingRate = 0.0001; // %0.01
              const fundingFeeVal = positionVolume * fundingRate;
              const isShort = pos.side === 'SHORT';
              // Pozitif fonlama oranında: Long öder (-), Short alır (+)
              const fundingAction = isShort ? 'Alınacak' : 'Ödenecek';
              const fundingPrefix = isShort ? '+' : '-';
              const fundingColor = isShort ? '#00c087' : '#f43f5e';

              const coinSymbol = pos.symbol.replace('USDT', '');

              return (
                <View key={pos.id} style={styles.card}>
                  {/* Başlık: SHORT 25x | İZOLE | XAUTUSDT */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.tagGroup}>
                      <View style={[styles.sidePill, isShort ? styles.bgShortPill : styles.bgLongPill]}>
                        <Text style={[styles.sidePillText, isShort ? styles.textShort : styles.textLong]}>
                          {pos.side} {pos.leverage}x
                        </Text>
                      </View>
                      <View style={pos.marginMode === 'CROSS' ? styles.crossPill : styles.isolatedPill}>
                        <Text style={pos.marginMode === 'CROSS' ? styles.crossPillText : styles.isolatedPillText}>
                          {pos.marginMode === 'CROSS' ? 'ÇAPRAZ' : 'İZOLE'}
                        </Text>
                      </View>
                      <Text style={styles.posSymbolText}>{pos.symbol}</Text>
                    </View>
                  </View>

                  {/* PnL & ROE Büyük Gösterim (Hassas Anlık Değişimler) */}
                  <View style={styles.pnlBox}>
                    <Text style={styles.pnlBoxLabel}>PnL (ROE%):</Text>
                    <View style={styles.pnlRowAlign}>
                      <Text style={[styles.pnlMainText, { color: isProfit ? '#00c087' : '#f43f5e' }]}>
                        {isProfit ? '+' : ''}{formatPnLAmount(pnl)}
                      </Text>
                      <Text style={[styles.roeSubText, { color: isProfit ? '#00c087' : '#f43f5e' }]}>
                        ({formatRoe(roe)})
                      </Text>
                    </View>
                  </View>

                  {/* Fiyatlar Grubu: Giriş Fiyatı - Anlık Fiyat */}
                  <View style={styles.twoColRow}>
                    <View style={styles.colHalf}>
                      <Text style={styles.metaLabel}>Giriş Fiyatı</Text>
                      <Text style={styles.metaValue}>{formatPositionPrice(pos.entryPrice * cryptoRate)}</Text>
                    </View>
                    <View style={styles.colHalf}>
                      <Text style={styles.metaLabel}>Anlık Fiyat</Text>
                      <View style={styles.priceWithChange}>
                        <Text style={styles.metaValue}>{formatPositionPrice(pos.currentPrice * cryptoRate)}</Text>
                        <Text style={[styles.priceChangePct, { color: priceChangePct >= 0 ? '#00c087' : '#f43f5e' }]}>
                          ({priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%)
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Marjin & Pozisyon Hacmi */}
                  <View style={styles.twoColRow}>
                    <View style={styles.colHalf}>
                      <Text style={styles.metaLabel}>Marjin (Teminat)</Text>
                      <Text style={styles.metaValue}>{formatMoney(posMargin)}</Text>
                    </View>
                    <View style={styles.colHalf}>
                      <Text style={styles.metaLabel}>Pozisyon Hacmi (Size)</Text>
                      <Text style={styles.metaValue}>{formatMoney(positionVolume)}</Text>
                    </View>
                  </View>

                  {/* Coin Miktarı & Likidasyon Fiyatı */}
                  <View style={styles.twoColRow}>
                    <View style={styles.colHalf}>
                      <Text style={styles.metaLabel}>Coin Miktarı</Text>
                      <Text style={styles.metaValue}>
                        {pos.amount.toFixed(4)} {coinSymbol}
                      </Text>
                    </View>
                    <View style={styles.colHalf}>
                      <Text style={styles.metaLabel}>Likidasyon Fiyatı</Text>
                      <Text style={[styles.metaValue, { color: '#f59e0b' }]}>
                        {pos.liquidationPrice > 0 ? formatPositionPrice(pos.liquidationPrice * cryptoRate) : '--'}
                      </Text>
                    </View>
                  </View>

                  {/* Kâr Al (TP) & Zarar Durdur (SL) - İlk girişe göre sabit seviyeler */}
                  <View style={styles.tpSlTwoColRow}>
                    <View style={styles.colHalf}>
                      <Text style={styles.metaLabel}>Kâr Al (TP)</Text>
                      <Text style={[styles.metaValueBold, { color: pos.takeProfit ? '#00c087' : '#64748b' }]}>
                        {pos.takeProfit
                          ? `$${pos.takeProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (${pos.side === 'LONG' ? '+' : '-'}${Math.abs(((pos.takeProfit - pos.entryPrice) / pos.entryPrice) * 100).toFixed(1)}%)`
                          : '--'}
                      </Text>
                    </View>
                    <View style={[styles.colHalf, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }]}>
                      <View>
                        <Text style={styles.metaLabel}>Zarar Durdur (SL)</Text>
                        <Text style={[styles.metaValueBold, { color: pos.stopLoss ? '#f43f5e' : '#64748b' }]}>
                          {pos.stopLoss
                            ? `$${pos.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (${pos.side === 'LONG' ? '-' : '+'}${Math.abs(((pos.stopLoss - pos.entryPrice) / pos.entryPrice) * 100).toFixed(1)}%)`
                            : '--'}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => openTpSlModal(pos)} style={styles.editTpSlBtn}>
                        <Ionicons name="create-outline" size={13} color={isChallenge ? "#60a5fa" : "#f0b90b"} style={{ marginRight: 3 }} />
                        <Text style={[styles.editTpSlText, isChallenge && { color: '#60a5fa' }]}>{pos.takeProfit || pos.stopLoss ? 'Düzenle' : 'Ayarla'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  {/* Risk & Likidasyona Mesafe */}
                  <View style={styles.detailListRow}>
                    <Text style={styles.metaLabel}>Marjin Oranı / Risk Seviyesi:</Text>
                    <Text style={[styles.metaValueBold, { color: riskColor }]}>
                      %{marginRatio.toFixed(2)} ({riskLevel})
                    </Text>
                  </View>

                  <View style={styles.detailListRow}>
                    <Text style={styles.metaLabel}>Likidasyona Mesafe:</Text>
                    <Text style={styles.metaValue}>
                      {distToLiq > 0 ? formatPositionPrice(distToLiq * cryptoRate) : '--'}
                    </Text>
                  </View>

                  {/* Fonlama Bilgileri */}
                  <View style={styles.detailListRow}>
                    <Text style={styles.metaLabel}>Fonlama Sayacı:</Text>
                    <Text style={styles.metaValueMonospace}>{fundingTimer}</Text>
                  </View>

                  <View style={styles.detailListRow}>
                    <Text style={styles.metaLabel}>8s Oranı:</Text>
                    <Text style={[styles.metaValue, { color: '#00c087' }]}>+0.0100%</Text>
                  </View>

                  <View style={styles.detailListRow}>
                    <Text style={styles.metaLabel}>Tahmini Fonlama Ücreti:</Text>
                    <Text style={[styles.metaValueBold, { color: fundingColor }]}>
                      {fundingPrefix}{formatMoney(fundingFeeVal)} ({fundingAction})
                    </Text>
                  </View>

                  {/* Pozisyonu Kapat Butonu (X ikonu yazının hemen solunda, aynı kutuda) */}
                  <TouchableOpacity
                    style={styles.closePositionFullBtn}
                    onPress={() => openCloseModal(pos)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close" size={17} color="#f43f5e" style={{ marginRight: 6 }} />
                    <Text style={styles.closePositionFullBtnText}>Pozisyonu Kapat</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )
        )}

        {/* 2. SEKMELİ GÖRÜNÜM: AÇIK EMİRLER */}
        {activeTab === 'ORDERS' && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="time-outline" size={42} color="#64748b" />
            </View>
            <Text style={styles.emptyText}>Bekleyen açık limit emri yok</Text>
            <Text style={styles.emptySubText}>
              İşlem sayfasından vereceğiniz Limit emirler tetiklenene kadar burada listelenir.
            </Text>

            <TouchableOpacity
              style={[styles.emptyActionBtn, isChallenge && { backgroundColor: '#3b82f6' }]}
              onPress={() => router.push(isChallenge ? '/challenge' : '/')}
              activeOpacity={0.85}
            >
              <Ionicons name="trending-up" size={18} color={isChallenge ? "#ffffff" : "#070a0f"} style={{ marginRight: 6 }} />
              <Text style={[styles.emptyActionBtnText, isChallenge && { color: '#ffffff' }]}>İşlem Ekranına Git</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 3. SEKMELİ GÖRÜNÜM: VARLIKLAR */}
        {activeTab === 'ASSETS' && (
          <View style={styles.assetsContainer}>
            <View style={styles.assetsCard}>
              <View style={styles.assetHeader}>
                <Ionicons name="wallet-outline" size={20} color={isChallenge ? "#3b82f6" : "#f0b90b"} />
                <Text style={[styles.assetHeaderTitle, isChallenge && { color: '#60a5fa' }]}>
                  {isChallenge ? 'Challenge Modu Cüzdanı' : 'Serbest Mod Cüzdanı'}
                </Text>
              </View>

              <View style={styles.assetItemRow}>
                <Text style={styles.assetItemLabel}>Toplam Cüzdan Bakiyesi:</Text>
                <Text style={styles.assetItemValue}>
                  {formatMoney(currentBalance * currencyRate)}{' '}
                  <Text style={styles.assetItemSubValue}>
                    {displayCurrency === 'TRY' ? `(~${((currentBalance * currencyRate) / usdRate).toFixed(2)} USD)` : `(~₺${((currentBalance * currencyRate) * usdRate).toFixed(2)})`}
                  </Text>
                </Text>
              </View>

              <View style={styles.assetItemRow}>
                <Text style={styles.assetItemLabel}>Kullanılabilir Bakiye (Marjin):</Text>
                <Text style={[styles.assetItemValue, { color: '#00c087' }]}>
                  {formatMoney(currentAvailable * currencyRate)}{' '}
                  <Text style={styles.assetItemSubValue}>
                    {displayCurrency === 'TRY' ? `(~${((currentAvailable * currencyRate) / usdRate).toFixed(2)} USD)` : `(~₺${((currentAvailable * currencyRate) * usdRate).toFixed(2)})`}
                  </Text>
                </Text>
              </View>

              <View style={styles.assetItemRow}>
                <Text style={styles.assetItemLabel}>Açık Pozisyon Teminatı:</Text>
                <Text style={styles.assetItemValue}>
                  {formatMoney(activeMargin * currencyRate)}{' '}
                  <Text style={styles.assetItemSubValue}>
                    {displayCurrency === 'TRY' ? `(~${((activeMargin * currencyRate) / usdRate).toFixed(2)} USD)` : `(~₺${((activeMargin * currencyRate) * usdRate).toFixed(2)})`}
                  </Text>
                </Text>
              </View>

              <View style={styles.assetItemRow}>
                <Text style={styles.assetItemLabel}>Gerçekleşmemiş Toplam PnL:</Text>
                <Text
                  style={[
                    styles.assetItemValue,
                    { color: totalUnrealizedPnL >= 0 ? '#00c087' : '#f43f5e' },
                  ]}
                >
                  {totalUnrealizedPnL >= 0 ? '+' : ''}{formatMoney(totalUnrealizedPnL)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.viewPortfolioLink}
                onPress={() => router.push('/portfolio')}
              >
                <Text style={[styles.viewPortfolioLinkText, isChallenge && { color: '#60a5fa' }]}>Tam Portföy ve Varlık Sayfası ➜</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      {/* TP / SL Düzenleme Modalı */}
      <Modal
        visible={!!editingPos}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPos(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>TP / SL Düzenle ({editingPos?.symbol})</Text>
              <TouchableOpacity onPress={() => setEditingPos(null)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              {editingPos
                ? `Giriş: $${editingPos.entryPrice.toLocaleString('en-US')}  |  Anlık: $${editingPos.currentPrice.toLocaleString('en-US')}`
                : ''}
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Kâr Al (TP) Fiyatı:</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder={editingPos?.takeProfit ? editingPos.takeProfit.toString() : 'Örn: 220000'}
                placeholderTextColor="#64748b"
                value={tpInput}
                onChangeText={setTpInput}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Zarar Durdur (SL) Fiyatı:</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                placeholder={editingPos?.stopLoss ? editingPos.stopLoss.toString() : 'Örn: 200000'}
                placeholderTextColor="#64748b"
                value={slInput}
                onChangeText={setSlInput}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingPos(null)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, isChallenge && { backgroundColor: '#3b82f6' }]}
                onPress={handleSaveTpSl}
              >
                <Text style={[styles.modalSaveText, isChallenge && { color: '#ffffff' }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Özel Şık Pozisyon Kapatma Modalı */}
      <Modal
        visible={!!closingTargetPos}
        transparent
        animationType="fade"
        onRequestClose={() => setClosingTargetPos(null)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalCard}>
            {/* Üst İkon & Başlık */}
            <View style={styles.confirmModalTopRow}>
              <View style={styles.confirmModalIconWrap}>
                <Ionicons name="close-circle" size={24} color="#f43f5e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmModalTitle}>Pozisyonu Kapat</Text>
                <Text style={styles.confirmModalSub}>
                  {closingTargetPos?.symbol} piyasa fiyatından kapatılacak
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setClosingTargetPos(null)}
                style={styles.confirmModalCloseIconBtn}
              >
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Pozisyon Özet Kutusu */}
            {closingTargetPos && (() => {
              const pnl = calculatePnL(
                closingTargetPos.entryPrice,
                closingTargetPos.currentPrice,
                closingTargetPos.amount,
                closingTargetPos.side
              );
              const roe = calculateROE(pnl, closingTargetPos.margin);
              const isProfit = pnl >= 0;

              return (
                <View style={styles.confirmModalSnapshotCard}>
                  {/* Sembol & Yön */}
                  <View style={styles.confirmSnapshotHeader}>
                    <View style={styles.confirmSymbolWrap}>
                      <Text style={styles.confirmSymbolText}>{closingTargetPos.symbol}</Text>
                      <View
                        style={[
                          styles.confirmSideBadge,
                          {
                            backgroundColor:
                              closingTargetPos.side === 'LONG'
                                ? 'rgba(0, 192, 135, 0.15)'
                                : 'rgba(244, 63, 94, 0.15)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.confirmSideText,
                            {
                              color: closingTargetPos.side === 'LONG' ? '#00c087' : '#f43f5e',
                            },
                          ]}
                        >
                          {closingTargetPos.side} {closingTargetPos.leverage}x
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.confirmAmountText}>
                      {closingTargetPos.amount.toFixed(4)} Coin
                    </Text>
                  </View>

                  <View style={styles.confirmDivider} />

                  {/* Fiyat Karşılaştırması */}
                  <View style={styles.confirmGridRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.confirmGridLabel}>Giriş Fiyatı</Text>
                      <Text style={styles.confirmGridVal}>
                        {formatPositionPrice(closingTargetPos.entryPrice * cryptoRate)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.confirmGridLabel}>Güncel Piyasa Çıkışı</Text>
                      <Text style={[styles.confirmGridVal, { color: '#60a5fa' }]}>
                        {formatPositionPrice(closingTargetPos.currentPrice * cryptoRate)}
                      </Text>
                    </View>
                  </View>

                  {/* TP & SL Varsa Onay Penceresinde de Göster */}
                  {(closingTargetPos.takeProfit || closingTargetPos.stopLoss) && (
                    <View style={styles.confirmGridRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.confirmGridLabel}>Kâr Al (TP)</Text>
                        <Text style={[styles.confirmGridVal, { color: '#00c087' }]}>
                          {closingTargetPos.takeProfit ? formatPositionPrice(closingTargetPos.takeProfit * cryptoRate) : '--'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.confirmGridLabel}>Zarar Durdur (SL)</Text>
                        <Text style={[styles.confirmGridVal, { color: '#f43f5e' }]}>
                          {closingTargetPos.stopLoss ? formatPositionPrice(closingTargetPos.stopLoss * cryptoRate) : '--'}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.confirmGridRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.confirmGridLabel}>İade Teminat</Text>
                      <Text style={styles.confirmGridVal}>
                        {formatMoney(closingTargetPos.margin * currencyRate)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.confirmGridLabel}>Gerçekleşecek Kâr/Zarar</Text>
                      <Text
                        style={[
                          styles.confirmGridValBold,
                          { color: isProfit ? '#00c087' : '#f43f5e' },
                        ]}
                      >
                        {isProfit ? '+' : ''}{formatMoney(pnl * pnlRate)} ({isProfit ? '+' : ''}{roe.toFixed(2)}%)
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Bilgilendirme Notu */}
            <View style={styles.confirmNoticeBox}>
              <Ionicons name="information-circle" size={15} color="#f59e0b" />
              <Text style={styles.confirmNoticeText}>
                Emir anında piyasa fiyatından karşılanacak ve kalan teminat bakiyenize aktarılacaktır.
              </Text>
            </View>

            {/* Butonlar */}
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setClosingTargetPos(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmCancelText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmExecuteBtn}
                onPress={handleConfirmClose}
                activeOpacity={0.8}
              >
                <Ionicons name="flash" size={15} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.confirmExecuteText}>Piyasa Kapat</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0e16',
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
  },
  headerLeftInfo: {
    justifyContent: 'center',
  },
  headerCount: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTotalPnl: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  newTradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111823',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  newTradeText: {
    color: '#00c087',
    fontSize: 12,
    fontWeight: 'bold',
  },
  closeAllBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  closeAllText: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabSegmentBar: {
    flexDirection: 'row',
    backgroundColor: '#0a0e16',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
  },
  tabSegmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#111823',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tabSegmentBtnActive: {
    backgroundColor: 'rgba(240, 185, 11, 0.15)',
    borderColor: '#f0b90b',
  },
  tabSegmentBtnActiveChallenge: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#3b82f6',
  },
  tabSegmentText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  tabSegmentTextActive: {
    color: '#f0b90b',
    fontWeight: 'bold',
  },
  tabSegmentTextActiveChallenge: {
    color: '#60a5fa',
    fontWeight: 'bold',
  },
  scrollList: {
    padding: 14,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#0d131d',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tagGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sidePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  bgShortPill: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  bgLongPill: {
    backgroundColor: 'rgba(0, 192, 135, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 192, 135, 0.4)',
  },
  sidePillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textShort: {
    color: '#f43f5e',
  },
  textLong: {
    color: '#00c087',
  },
  isolatedPill: {
    backgroundColor: '#162030',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#223249',
  },
  isolatedPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  crossPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  crossPillText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
  },
  posSymbolText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pnlBox: {
    backgroundColor: '#070a0f',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#162030',
  },
  pnlBoxLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  pnlRowAlign: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  pnlMainText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  roeSubText: {
    fontSize: 14,
    fontWeight: '700',
  },
  twoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  colHalf: {
    flex: 1,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  metaValue: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  metaValueBold: {
    fontSize: 13,
    fontWeight: '800',
  },
  metaValueMonospace: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  priceWithChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  priceChangePct: {
    fontSize: 11,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#162030',
    marginVertical: 10,
  },
  detailListRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tpSlTwoColRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  editTpSlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162030',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#24344d',
  },
  editTpSlText: {
    color: '#f0b90b',
    fontSize: 11,
    fontWeight: '700',
  },
  closePositionFullBtn: {
    width: '100%',
    backgroundColor: '#162030',
    paddingVertical: 11,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#26354a',
    marginTop: 12,
  },
  closePositionFullBtnText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },

  // Özel Şık Onay Modalı Stilleri
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  confirmModalCard: {
    width: '100%',
    backgroundColor: '#0c121e',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    shadowColor: '#f43f5e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  confirmModalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  confirmModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  confirmModalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  confirmModalSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  confirmModalCloseIconBtn: {
    padding: 6,
  },
  confirmModalSnapshotCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f293d',
    marginBottom: 14,
  },
  confirmSnapshotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmSymbolWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmSymbolText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  confirmSideBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confirmSideText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  confirmAmountText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 10,
  },
  confirmGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmGridLabel: {
    color: '#64748b',
    fontSize: 11.5,
  },
  confirmGridVal: {
    color: '#e2e8f0',
    fontSize: 12.5,
    fontWeight: '600',
  },
  confirmGridValBold: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  confirmNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginBottom: 16,
  },
  confirmNoticeText: {
    flex: 1,
    color: '#fbbf24',
    fontSize: 11.5,
    lineHeight: 16,
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#162030',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#26354a',
  },
  confirmCancelText: {
    color: '#94a3b8',
    fontSize: 13.5,
    fontWeight: '700',
  },
  confirmExecuteBtn: {
    flex: 1.3,
    backgroundColor: '#e11d48',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  confirmExecuteText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#111823',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00c087',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
  },
  emptyActionBtnText: {
    color: '#070a0f',
    fontSize: 14,
    fontWeight: 'bold',
  },
  assetsContainer: {
    paddingTop: 4,
  },
  assetsCard: {
    backgroundColor: '#0d131d',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1b2434',
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
  },
  assetHeaderTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  assetItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
  },
  assetItemLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  assetItemValue: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: 'bold',
  },
  assetItemSubValue: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'normal',
  },
  viewPortfolioLink: {
    marginTop: 16,
    backgroundColor: '#162030',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  viewPortfolioLinkText: {
    color: '#f0b90b',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#0d131d',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#24344d',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 16,
  },
  modalInputGroup: {
    marginBottom: 14,
  },
  modalInputLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#070a0f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#162030',
  },
  modalCancelText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f0b90b',
  },
  modalSaveText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
  },
});