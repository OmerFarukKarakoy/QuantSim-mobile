import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TradeHistoryItem, useTradeStore } from '../src/store/useTradeStore';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { history, currency, usdTryRate, setCurrency, activeMode, challenge } = useTradeStore();

  const isChallenge = activeMode === 'CHALLENGE';
  const displayCurrency = isChallenge ? (challenge?.currency || 'TRY') : currency;

  // Arama & Filtre State'leri
  const [searchQuery, setSearchQuery] = useState('');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  const currencySymbol = displayCurrency === 'TRY' ? '₺' : '$';
  const priceRate = displayCurrency === 'TRY' ? (usdTryRate > 0 ? usdTryRate : 34.85) : 1;
  const balanceRate = isChallenge ? 1 : (currency === 'TRY' ? (usdTryRate > 0 ? usdTryRate : 34.85) : 1);

  const formatMoney = (val: number, maxDigits = 2) => {
    return `${currencySymbol}${val.toLocaleString('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: maxDigits,
    })}`;
  };

  // 1. Önceki İşlemler (Serbest mod veya Challenge mod geçmişi)
  const displayHistory: TradeHistoryItem[] = useMemo(() => {
    if (isChallenge) {
      return challenge?.history || [];
    }
    return history || [];
  }, [isChallenge, challenge?.history, history]);

  // Arama & Filtreleme Mantığı
  const filteredHistory = useMemo(() => {
    return displayHistory.filter((item) => {
      // 1. Search Bar (Sembol ara)
      if (searchQuery.trim().length > 0) {
        const query = searchQuery.trim().toUpperCase();
        if (!item.symbol.toUpperCase().includes(query)) {
          return false;
        }
      }

      // 2. Yön Filtresi (Long / Short)
      if (sideFilter === 'LONG' && item.side !== 'LONG') return false;
      if (sideFilter === 'SHORT' && item.side !== 'SHORT') return false;

      // 3. Sonuç Filtresi (Kârlı / Zararlı)
      if (outcomeFilter === 'WIN' && item.pnl <= 0.01) return false;
      if (outcomeFilter === 'LOSS' && item.pnl >= -0.01) return false;

      return true;
    });
  }, [displayHistory, searchQuery, sideFilter, outcomeFilter]);

  const getReasonInfo = (reason: TradeHistoryItem['closeReason']) => {
    switch (reason) {
      case 'TP':
        return {
          icon: '🎯',
          label: 'Kar Al (TP)',
          bg: 'rgba(0, 192, 135, 0.15)',
          color: '#00c087',
          borderColor: 'rgba(0, 192, 135, 0.3)',
        };
      case 'SL':
        return {
          icon: '🛑',
          label: 'Zararı Durdur (SL)',
          bg: 'rgba(244, 63, 94, 0.15)',
          color: '#f43f5e',
          borderColor: 'rgba(244, 63, 94, 0.3)',
        };
      case 'LIQUIDATION':
        return {
          icon: '💀',
          label: 'Likidasyon',
          bg: 'rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          borderColor: 'rgba(239, 68, 68, 0.4)',
        };
      default:
        return {
          icon: '⚡',
          label: 'Manuel Kapat',
          bg: 'rgba(148, 163, 184, 0.15)',
          color: '#94a3b8',
          borderColor: 'rgba(148, 163, 184, 0.3)',
        };
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '20:05:05 26 Eyl';
    if (ts.includes('Eyl') || ts.includes('Oca') || ts.includes('Şub') || ts.includes('Mar') || ts.includes('Nis') || ts.includes('May') || ts.includes('Haz') || ts.includes('Tem') || ts.includes('Ağu') || ts.includes('Eki') || ts.includes('Kas') || ts.includes('Ara')) {
      return ts;
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const date = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      return `${time} ${date}`;
    }
    if (ts.includes(':')) {
      return `${ts} ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`;
    }
    return ts;
  };

  return (
    <View style={styles.container}>
      {/* 1. Üst Başlık & Para Birimi */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 0) + 2 }]}>
        <View>
          <Text style={styles.headerTitle}>İşlem Geçmişi</Text>
          <Text style={styles.headerSub}>
            {isChallenge ? 'QuantSim Challenge Modu' : 'QuantSim Serbest Mod'} • {filteredHistory.length} / {displayHistory.length} Emir
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
        </View>
      </View>

      {/* 2. TABLO ÜSTÜ ARAMA & FİLTRE BÖLÜMÜ */}
      <View style={styles.filtersTopContainer}>
        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <Ionicons name="search-outline" size={18} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Sembol ara (Örn: BTC)..."
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={17} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Yön & Sonuç Filtreleri */}
        <View style={styles.filterRowsGroup}>
          {/* Yön Filtresi */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionLabel}>Yön:</Text>
            <View style={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, sideFilter === 'ALL' && styles.filterChipActive]}
                onPress={() => setSideFilter('ALL')}
              >
                <Text style={[styles.filterChipText, sideFilter === 'ALL' && styles.filterChipTextActive]}>
                  Tüm Yönler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, sideFilter === 'LONG' && styles.filterChipActiveLong]}
                onPress={() => setSideFilter('LONG')}
              >
                <Text style={[styles.filterChipText, sideFilter === 'LONG' && styles.filterChipTextActiveLong]}>
                  Long 📈
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, sideFilter === 'SHORT' && styles.filterChipActiveShort]}
                onPress={() => setSideFilter('SHORT')}
              >
                <Text style={[styles.filterChipText, sideFilter === 'SHORT' && styles.filterChipTextActiveShort]}>
                  Short 📉
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sonuç Filtresi */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionLabel}>Sonuç:</Text>
            <View style={styles.chipsRow}>
              <TouchableOpacity
                style={[styles.filterChip, outcomeFilter === 'ALL' && styles.filterChipActive]}
                onPress={() => setOutcomeFilter('ALL')}
              >
                <Text style={[styles.filterChipText, outcomeFilter === 'ALL' && styles.filterChipTextActive]}>
                  Tüm Sonuçlar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, outcomeFilter === 'WIN' && styles.filterChipActiveWin]}
                onPress={() => setOutcomeFilter('WIN')}
              >
                <Text style={[styles.filterChipText, outcomeFilter === 'WIN' && styles.filterChipTextActiveWin]}>
                  Kârlı (🟢)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterChip, outcomeFilter === 'LOSS' && styles.filterChipActiveLoss]}
                onPress={() => setOutcomeFilter('LOSS')}
              >
                <Text style={[styles.filterChipText, outcomeFilter === 'LOSS' && styles.filterChipTextActiveLoss]}>
                  Zararlı (🔴)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* 3. İŞLEM KARTLARI LİSTESİ */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}
      >
        {filteredHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons
                name={displayHistory.length === 0 ? 'time-outline' : 'search-outline'}
                size={36}
                color="#64748b"
              />
            </View>
            <Text style={styles.emptyText}>
              {displayHistory.length === 0 ? 'Henüz İşlem Geçmişi Yok' : 'Eşleşen İşlem Bulunamadı'}
            </Text>
            <Text style={styles.emptySubText}>
              {displayHistory.length === 0
                ? isChallenge
                  ? 'Trade Challenge modunda tamamlanan pozisyonlarınız burada listelenecektir.'
                  : 'Serbest modda tamamlanan pozisyonlarınız burada listelenecektir.'
                : 'Arama filtrenizi temizleyerek veya değiştirerek tekrar deneyebilirsiniz.'}
            </Text>
            {displayHistory.length === 0 ? (
              <TouchableOpacity
                style={[
                  styles.clearFilterBtn,
                  { backgroundColor: isChallenge ? '#2563eb' : '#f0b90b', paddingHorizontal: 20 },
                ]}
                onPress={() => router.push(isChallenge ? '/challenge' : '/')}
              >
                <Text style={[styles.clearFilterBtnText, { color: isChallenge ? '#ffffff' : '#0b0e11' }]}>
                  İşlem Ekranına Git
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => {
                  setSearchQuery('');
                  setSideFilter('ALL');
                  setOutcomeFilter('ALL');
                }}
              >
                <Text style={styles.clearFilterBtnText}>Filtreleri Sıfırla</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredHistory.map((item) => {
            const isProfit = item.pnl > 0.01;
            const isLoss = item.pnl < -0.01;
            const isLong = item.side === 'LONG';
            const reason = getReasonInfo(item.closeReason);

            // Değişim yüzdesi: ((exit - entry) / entry) * 100
            const priceChangePercent = item.entryPrice > 0
              ? ((item.exitPrice - item.entryPrice) / item.entryPrice) * 100
              : 0;

            // Marjin
            const marginValue = item.margin || (item.entryPrice * item.amount) / item.leverage;

            return (
              <View key={item.id} style={styles.card}>
                {/* 1. Satır: Tarih & Kapatma Nedeni */}
                <View style={styles.cardTopBar}>
                  <View style={styles.dateWrap}>
                    <Ionicons name="time-outline" size={13} color="#64748b" />
                    <Text style={styles.dateText}>{formatTimestamp(item.timestamp)}</Text>
                  </View>

                  {/* Kapatma Nedeni Rozeti */}
                  <View
                    style={[
                      styles.reasonBadge,
                      { backgroundColor: reason.bg, borderColor: reason.borderColor },
                    ]}
                  >
                    <Text style={styles.reasonIcon}>{reason.icon}</Text>
                    <Text style={[styles.reasonLabel, { color: reason.color }]}>
                      {reason.label}
                    </Text>
                  </View>
                </View>

                {/* 2. Satır: Sembol & Yön Bilgisi */}
                <View style={styles.symbolSideRow}>
                  <Text style={styles.symbolText}>{item.symbol}</Text>
                  <View
                    style={[
                      styles.sideBadge,
                      { backgroundColor: isLong ? 'rgba(0, 192, 135, 0.15)' : 'rgba(244, 63, 94, 0.15)' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sideBadgeText,
                        { color: isLong ? '#00c087' : '#f43f5e' },
                      ]}
                    >
                      {item.side} {item.leverage}x
                    </Text>
                  </View>
                </View>

                {/* 3. Satır: Giriş / Çıkış Fiyatı (Değişim Yüzdesi) */}
                <View style={styles.priceRowBox}>
                  <Text style={styles.priceBoxLabel}>Giriş / Çıkış Fiyatı (Değişim):</Text>
                  <Text style={styles.priceBoxValue}>
                    {formatMoney(item.entryPrice * priceRate)} → {formatMoney(item.exitPrice * priceRate)}
                    <Text
                      style={{
                        color: priceChangePercent >= 0 ? '#00c087' : '#f43f5e',
                        fontWeight: 'bold',
                      }}
                    >
                      {' '}({priceChangePercent >= 0 ? '+%' : '-%'}{Math.abs(priceChangePercent).toFixed(2)})
                    </Text>
                  </Text>
                </View>

                {/* 4. Satır: Marjin & Gerçekleşen PnL / Komisyon */}
                <View style={styles.cardFooterGrid}>
                  {/* Marjin */}
                  <View style={styles.footerCol}>
                    <Text style={styles.footerColLabel}>Marjin</Text>
                    <Text style={styles.marginValueText}>
                      {formatMoney(marginValue * balanceRate)}
                    </Text>
                  </View>

                  {/* Gerçekleşen PnL & Komisyon */}
                  <View style={[styles.footerCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.footerColLabel}>Gerçekleşen PnL / Komisyon</Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={[
                          styles.pnlMainText,
                          { color: isProfit ? '#00c087' : isLoss ? '#f43f5e' : '#94a3b8' },
                        ]}
                      >
                        {isProfit ? '+' : ''}{formatMoney(item.pnl * balanceRate)}
                        <Text style={styles.roeText}>
                          {' '}({item.roe >= 0 ? '+' : ''}{item.roe.toFixed(2)}%)
                        </Text>
                      </Text>
                      <Text style={styles.feeText}>
                        Komisyon: -{formatMoney(item.fee * balanceRate)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  newTradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111823',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  newTradeText: {
    color: '#00c087',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // =========================================================================
  // TABLO ÜSTÜ ARAMA & FİLTRELER
  // =========================================================================
  filtersTopContainer: {
    backgroundColor: '#0d131d',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#162030',
    gap: 10,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111823',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 8,
    fontWeight: '600',
  },
  filterRowsGroup: {
    gap: 8,
  },
  filterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterSectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
    width: 44,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#111823',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterChipActiveLong: {
    backgroundColor: 'rgba(0, 192, 135, 0.15)',
    borderColor: '#00c087',
  },
  filterChipActiveShort: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
  },
  filterChipActiveWin: {
    backgroundColor: 'rgba(0, 192, 135, 0.15)',
    borderColor: '#00c087',
  },
  filterChipActiveLoss: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
  },
  filterChipText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  filterChipTextActiveLong: {
    color: '#00c087',
  },
  filterChipTextActiveShort: {
    color: '#f43f5e',
  },
  filterChipTextActiveWin: {
    color: '#00c087',
  },
  filterChipTextActiveLoss: {
    color: '#f43f5e',
  },

  // =========================================================================
  // İŞLEM KARTI STİLLERİ
  // =========================================================================
  scrollList: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#0d131d',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#1b2434',
  },
  cardTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '600',
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  reasonIcon: {
    fontSize: 11,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  symbolSideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  symbolText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  sideBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  sideBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  priceRowBox: {
    backgroundColor: '#111823',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 10,
  },
  priceBoxLabel: {
    color: '#64748b',
    fontSize: 10.5,
    marginBottom: 2,
  },
  priceBoxValue: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardFooterGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#162030',
    paddingTop: 10,
  },
  footerCol: {
    flex: 1,
  },
  footerColLabel: {
    color: '#64748b',
    fontSize: 10.5,
    marginBottom: 2,
  },
  marginValueText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  pnlMainText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  roeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  feeText: {
    color: '#64748b',
    fontSize: 10.5,
    marginTop: 2,
  },

  // Boş Durum
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#111823',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  clearFilterBtn: {
    marginTop: 14,
    backgroundColor: '#111823',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  clearFilterBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
});