import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import { fetchAccountBalance, placeRealOrder } from '../services/binance';
import { calculatePnL, calculateROE } from '../utils/math';

export interface Position {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    leverage: number;
    marginMode?: 'CROSS' | 'ISOLATED';
    entryPrice: number;
    currentPrice: number;
    amount: number;
    margin: number;
    liquidationPrice: number;
    takeProfit?: number;
    stopLoss?: number;
}

export interface TradeHistoryItem {
    id: string;
    symbol: string;
    side: 'LONG' | 'SHORT';
    leverage: number;
    marginMode?: 'CROSS' | 'ISOLATED';
    entryPrice: number;
    exitPrice: number;
    amount: number;
    margin?: number;
    pnl: number;
    roe: number;
    fee: number;
    closeReason: 'TP' | 'SL' | 'MANUAL' | 'LIQUIDATION';
    timestamp: string;
}

export interface ChallengeState {
    initialBalance: number;
    balance: number;
    profitTarget: number;
    maxDailyLoss: number;
    maxTotalLoss: number;
    status: 'ACTIVE' | 'PASSED' | 'FAILED';
    positions: Position[];
    history: TradeHistoryItem[];
    currency: 'TRY' | 'USD';
    isConfigured: boolean;
}

export const DEFAULT_CHALLENGE: ChallengeState = {
    initialBalance: 100000.0,
    balance: 100000.0,
    profitTarget: 100000.0, // Başlangıç miktarını katlama hedefi (2x)
    maxDailyLoss: 15000.0,
    maxTotalLoss: 30000.0,
    status: 'ACTIVE',
    positions: [],
    history: [],
    currency: 'TRY',
    isConfigured: false,
};

interface TradeState {
    balance: number;
    availableBalance: number;
    positions: Position[];
    history: TradeHistoryItem[];
    isLoading: boolean;
    isHydrated: boolean;
    setHasHydrated: (val: boolean) => void;

    // Aktif Mod: 'FREE' (Serbest Mod) veya 'CHALLENGE' (Trade Challenge)
    activeMode: 'FREE' | 'CHALLENGE';
    setActiveMode: (mode: 'FREE' | 'CHALLENGE') => void;

    // Para Birimi Tercihi
    currency: 'TRY' | 'USD';
    usdTryRate: number;
    setCurrency: (currency: 'TRY' | 'USD') => void;

    hasCustomBalance: boolean;
    fetchUsdTryRate: () => Promise<void>;

    // Serbest Mod Bakiye Ekleme & Sıfırlama
    depositFreeBalance: (amountInUsd: number) => void;
    resetFreeBalance: (newBalanceInUsd: number) => void;

    // Challenge Modu State (ve yazım hatası dayanıklılığı için challange aliası)
    challenge: ChallengeState;
    challange: ChallengeState;

    // Eylemler - Serbest Mod
    syncBinanceBalance: () => Promise<void>;
    openPosition: (params: {
        symbol: string;
        side: 'LONG' | 'SHORT';
        leverage: number;
        marginMode?: 'CROSS' | 'ISOLATED';
        entryPrice: number;
        amount: number;
        liquidationPrice: number;
        takeProfit?: number;
        stopLoss?: number;
    }) => Promise<boolean>;
    closePosition: (id: string, currentPrice: number, reason?: TradeHistoryItem['closeReason']) => Promise<void>;
    updatePositionTPSL: (id: string, takeProfit?: number, stopLoss?: number) => void;
    updateMarketPrice: (symbol: string, newPrice: number) => void;

    // Eylemler - Challenge Modu
    configureChallenge: (initialBalance: number, currency: 'TRY' | 'USD') => void;
    openChallengePosition: (params: {
        symbol: string;
        side: 'LONG' | 'SHORT';
        leverage: number;
        marginMode?: 'CROSS' | 'ISOLATED';
        entryPrice: number;
        amount: number;
        liquidationPrice: number;
        takeProfit?: number;
        stopLoss?: number;
    }) => Promise<boolean>;
    closeChallengePosition: (id: string, currentPrice: number, reason?: TradeHistoryItem['closeReason']) => Promise<void>;
    updateChallengePositionTPSL: (id: string, takeProfit?: number, stopLoss?: number) => void;
    resetChallenge: (initialBalance?: number, currency?: 'TRY' | 'USD') => void;
}

// Çakışan pozisyon kapatma çağrılarını ve yarış durumlarını (race condition) önleme
const closingPositionIds = new Set<string>();

// Dosya Sistemi ile Kalıcı Hafıza (Persistence) Adaptörü
let writeTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;
let pendingPath: string | null = null;

const flushPendingWrite = async () => {
    if (pendingPath && pendingValue !== null) {
        const p = pendingPath;
        const v = pendingValue;
        pendingPath = null;
        pendingValue = null;
        try {
            await FileSystem.writeAsStringAsync(p, v);
        } catch (e) {
            console.warn('Hafızaya yazılırken hata oluştu:', e);
        }
    }
};

const getStorageFilePath = (name: string): string | null => {
    const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!dir) return null;
    return `${dir}${name}.json`;
};

const persistentFileStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            return localStorage.getItem(name);
        }
        try {
            const path = getStorageFilePath(name);
            if (!path) return null;
            const info = await FileSystem.getInfoAsync(path);
            if (!info.exists) {
                return null;
            }
            return await FileSystem.readAsStringAsync(path);
        } catch (e) {
            console.warn('Hafızadan okunurken hata oluştu:', e);
            return null;
        }
    },
    setItem: async (name: string, value: string): Promise<void> => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            localStorage.setItem(name, value);
            return;
        }
        const path = getStorageFilePath(name);
        if (!path) return;
        pendingPath = path;
        pendingValue = value;
        if (writeTimeout) clearTimeout(writeTimeout);
        writeTimeout = setTimeout(flushPendingWrite, 300);
    },
    removeItem: async (name: string): Promise<void> => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            localStorage.removeItem(name);
            return;
        }
        try {
            const path = getStorageFilePath(name);
            if (!path) return;
            await FileSystem.deleteAsync(path, { idempotent: true });
        } catch (e) {
            console.warn('Hafıza silinirken hata oluştu:', e);
        }
    },
};

export const useTradeStore = create<TradeState>()(
    persist(
        (set, get) => ({
            balance: 10000.0,
            availableBalance: 10000.0,
            positions: [],
            history: [],
            isLoading: false,
            isHydrated: false,
            setHasHydrated: (val) => set({ isHydrated: val }),
            hasCustomBalance: false,
            activeMode: 'FREE',
            setActiveMode: (mode) => {
                if (get().activeMode !== mode) {
                    set({ activeMode: mode });
                }
            },

            currency: 'TRY',
            usdTryRate: 34.85,
            setCurrency: (currency) => set({ currency }),

            fetchUsdTryRate: async () => {
                try {
                    const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTTRY');
                    const data = await res.json();
                    if (data && data.price) {
                        const rate = parseFloat(data.price);
                        if (rate > 0) {
                            set({ usdTryRate: rate });
                        }
                    }
                } catch {
                    // fallback stays at 34.85
                }
            },

            depositFreeBalance: (amountInUsd) => {
                set((state) => ({
                    balance: state.balance + amountInUsd,
                    availableBalance: state.availableBalance + amountInUsd,
                    hasCustomBalance: true,
                }));
            },

            resetFreeBalance: (newBalanceInUsd) => {
                set({
                    balance: newBalanceInUsd,
                    availableBalance: newBalanceInUsd,
                    positions: [],
                    history: [],
                    hasCustomBalance: true,
                });
            },

            challenge: { ...DEFAULT_CHALLENGE },
            challange: { ...DEFAULT_CHALLENGE },

            // 1. Binance Testnet Bakiyesini Eşitle
            syncBinanceBalance: async () => {
                const state = get();
                // Eğer kullanıcı kendi bakiyesini belirlediyse, açık pozisyonu veya işlem geçmişi varsa üzerine yazma
                if (state.hasCustomBalance || state.positions.length > 0 || state.history.length > 0) {
                    return;
                }
                set({ isLoading: true });
                const acc = await fetchAccountBalance();
                if (acc) {
                    set({
                        balance: acc.totalWalletBalance,
                        availableBalance: acc.availableBalance,
                        isLoading: false,
                    });
                } else {
                    set({ isLoading: false });
                }
            },

            // 2. Yeni Pozisyon Aç (Serbest Mod)
            openPosition: async ({ symbol, side, leverage, marginMode = 'CROSS', entryPrice, amount, liquidationPrice, takeProfit, stopLoss }) => {
                const margin = (entryPrice * amount) / leverage;
                const { availableBalance } = get();

                if (margin > availableBalance) {
                    return false;
                }

                const binanceSide = side === 'LONG' ? 'BUY' : 'SELL';
                try {
                    await placeRealOrder(symbol, binanceSide, amount);
                } catch (e) {
                    // Testnet veya ağ hatası simülasyonu engellemesin
                }

                const newPos: Position = {
                    id: Date.now().toString(),
                    symbol,
                    side,
                    leverage,
                    marginMode,
                    entryPrice,
                    currentPrice: entryPrice,
                    amount,
                    margin,
                    liquidationPrice,
                    takeProfit,
                    stopLoss,
                };

                set((state) => ({
                    positions: [newPos, ...state.positions],
                    availableBalance: state.availableBalance - margin,
                    hasCustomBalance: true,
                }));

                return true;
            },

            // 3. Pozisyon Kapat (Serbest Mod)
            closePosition: async (id, currentPrice, reason = 'MANUAL') => {
                if (closingPositionIds.has(id)) return;
                closingPositionIds.add(id);

                const { positions, history, balance, availableBalance } = get();
                const pos = positions.find((p) => p.id === id);
                if (!pos) {
                    closingPositionIds.delete(id);
                    return;
                }

                // Testnet emrini arka planda async yürüt (arayüzü ve React iş parçacığını kilitlemez)
                const closeSide = pos.side === 'LONG' ? 'SELL' : 'BUY';
                placeRealOrder(pos.symbol, closeSide, pos.amount).catch(() => {});

                let netPnl: number;
                const fee = (currentPrice * pos.amount) * 0.0004;

                if (reason === 'LIQUIDATION') {
                    if (pos.marginMode === 'ISOLATED') {
                        // İzole marjin: Yalnızca işleme ayrılan marjin kaybedilir
                        netPnl = -pos.margin;
                    } else {
                        // Çapraz marjin: Cüzdan teminatı devreye girer
                        const rawLoss = calculatePnL(pos.entryPrice, currentPrice, pos.amount, pos.side);
                        netPnl = Math.min(-pos.margin, rawLoss - fee);
                    }
                } else {
                    const pnl = calculatePnL(pos.entryPrice, currentPrice, pos.amount, pos.side);
                    netPnl = pnl - fee;
                }

                const roe = calculateROE(netPnl, pos.margin);

                const historyRecord: TradeHistoryItem = {
                    id: Date.now().toString(),
                    symbol: pos.symbol,
                    side: pos.side,
                    leverage: pos.leverage,
                    marginMode: pos.marginMode,
                    entryPrice: pos.entryPrice,
                    exitPrice: currentPrice,
                    amount: pos.amount,
                    margin: pos.margin,
                    pnl: netPnl,
                    roe,
                    fee,
                    closeReason: reason,
                    timestamp: `${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`,
                };

                const newBalance = Math.max(0, balance + netPnl);
                const newAvailable = Math.max(0, availableBalance + pos.margin + netPnl);

                set((state) => ({
                    positions: (state.positions || []).filter((p) => p.id !== id),
                    history: [historyRecord, ...(state.history || [])],
                    balance: newBalance,
                    availableBalance: newAvailable,
                    hasCustomBalance: true,
                }));

                closingPositionIds.delete(id);
            },

            // 4. TP/SL Güncelle (Serbest Mod)
            updatePositionTPSL: (id, takeProfit, stopLoss) => {
                set((state) => ({
                    positions: state.positions.map((p) =>
                        p.id === id ? { ...p, takeProfit, stopLoss } : p
                    ),
                }));
            },

            // 5. Challenge Yapılandır
            configureChallenge: (initialBalance: number, currency: 'TRY' | 'USD') => {
                const newChallenge: ChallengeState = {
                    initialBalance,
                    balance: initialBalance,
                    profitTarget: initialBalance, // Başlangıç miktarını katlama hedefi (2x)
                    maxDailyLoss: initialBalance * 0.15,
                    maxTotalLoss: initialBalance * 0.30,
                    status: 'ACTIVE',
                    positions: [],
                    history: [],
                    currency,
                    isConfigured: true,
                };
                set({
                    challenge: newChallenge,
                    challange: newChallenge,
                });
            },

            // 6. Challenge Pozisyonu Aç
            openChallengePosition: async ({ symbol, side, leverage, marginMode = 'CROSS', entryPrice, amount, liquidationPrice, takeProfit, stopLoss }) => {
                const { challenge, usdTryRate } = get();
                const activeChallenge = challenge || DEFAULT_CHALLENGE;
                const rate = activeChallenge.currency === 'TRY' ? (usdTryRate > 0 ? usdTryRate : 34.85) : 1;
                const marginInChallengeCurrency = ((entryPrice * amount) / leverage) * rate;

                const challengePositions = activeChallenge.positions || [];
                const usedMargin = challengePositions.reduce((sum, p) => sum + p.margin, 0);
                const availableMargin = activeChallenge.balance - usedMargin;

                if (marginInChallengeCurrency > availableMargin) {
                    return false;
                }

                const newPos: Position = {
                    id: Date.now().toString(),
                    symbol,
                    side,
                    leverage,
                    marginMode,
                    entryPrice,
                    currentPrice: entryPrice,
                    amount,
                    margin: marginInChallengeCurrency,
                    liquidationPrice,
                    takeProfit,
                    stopLoss,
                };

                const updatedChallenge: ChallengeState = {
                    ...activeChallenge,
                    positions: [newPos, ...challengePositions],
                };

                set({
                    challenge: updatedChallenge,
                    challange: updatedChallenge,
                });

                return true;
            },

            // 7. Challenge Pozisyonu Kapat
            closeChallengePosition: async (id, currentPrice, reason = 'MANUAL') => {
                if (closingPositionIds.has(id)) return;
                closingPositionIds.add(id);

                const { challenge, usdTryRate } = get();
                const activeChallenge = challenge || DEFAULT_CHALLENGE;
                const challengePositions = activeChallenge.positions || [];
                const pos = challengePositions.find((p) => p.id === id);
                if (!pos) {
                    closingPositionIds.delete(id);
                    return;
                }

                const rate = activeChallenge.currency === 'TRY' ? (usdTryRate > 0 ? usdTryRate : 34.85) : 1;
                let netPnl: number;
                const feeInChallengeCurrency = ((currentPrice * pos.amount) * 0.0004) * rate;

                if (reason === 'LIQUIDATION') {
                    if (pos.marginMode === 'ISOLATED') {
                        // İzole: Sadece bu pozisyona bağlanan marjin kaybedilir
                        netPnl = -pos.margin;
                    } else {
                        // Çapraz: Toplam kayıp
                        const pnlUsd = calculatePnL(pos.entryPrice, currentPrice, pos.amount, pos.side);
                        const rawLoss = pnlUsd * rate;
                        netPnl = Math.min(-pos.margin, rawLoss - feeInChallengeCurrency);
                    }
                } else {
                    const pnlUsd = calculatePnL(pos.entryPrice, currentPrice, pos.amount, pos.side);
                    const pnlInChallengeCurrency = pnlUsd * rate;
                    netPnl = pnlInChallengeCurrency - feeInChallengeCurrency;
                }

                const roe = calculateROE(netPnl, pos.margin);

                const historyRecord: TradeHistoryItem = {
                    id: Date.now().toString(),
                    symbol: pos.symbol,
                    side: pos.side,
                    leverage: pos.leverage,
                    marginMode: pos.marginMode,
                    entryPrice: pos.entryPrice,
                    exitPrice: currentPrice,
                    amount: pos.amount,
                    margin: pos.margin,
                    pnl: netPnl,
                    roe,
                    fee: feeInChallengeCurrency,
                    closeReason: reason,
                    timestamp: `${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`,
                };

                const newBalance = Math.max(0, activeChallenge.balance + netPnl);
                const totalLoss = activeChallenge.initialBalance - newBalance;

                let newStatus = activeChallenge.status;
                if (newBalance >= activeChallenge.initialBalance + activeChallenge.profitTarget) {
                    newStatus = 'PASSED';
                } else if (totalLoss >= activeChallenge.maxTotalLoss || newBalance <= 0) {
                    newStatus = 'FAILED';
                }

                set((state) => {
                    const currentChallenge = state.challenge || DEFAULT_CHALLENGE;
                    const cPositions = currentChallenge.positions || [];
                    const updatedChallenge: ChallengeState = {
                        ...currentChallenge,
                        balance: newBalance,
                        status: newStatus,
                        positions: cPositions.filter((p) => p.id !== id),
                        history: [historyRecord, ...(currentChallenge.history || [])],
                    };
                    return {
                        challenge: updatedChallenge,
                        challange: updatedChallenge,
                    };
                });

                closingPositionIds.delete(id);
            },

            // 8. Challenge TP/SL Güncelle
            updateChallengePositionTPSL: (id, takeProfit, stopLoss) => {
                set((state) => {
                    const activeChallenge = state.challenge || DEFAULT_CHALLENGE;
                    const challengePositions = activeChallenge.positions || [];
                    const updatedChallenge: ChallengeState = {
                        ...activeChallenge,
                        positions: challengePositions.map((p) =>
                            p.id === id ? { ...p, takeProfit, stopLoss } : p
                        ),
                    };
                    return {
                        challenge: updatedChallenge,
                        challange: updatedChallenge,
                    };
                });
            },

            // 9. Challenge'ı Sıfırla
            resetChallenge: (initialBalance?: number, currency?: 'TRY' | 'USD') => {
                const activeChallenge = get().challenge || DEFAULT_CHALLENGE;
                const targetBalance = initialBalance ?? activeChallenge.initialBalance ?? 100000;
                const targetCurrency = currency ?? activeChallenge.currency ?? 'TRY';
                get().configureChallenge(targetBalance, targetCurrency);
            },

            // 9. Piyasa Fiyatını Güncelle ve TP/SL Kontrol Et
            updateMarketPrice: (symbol, newPrice) => {
                if (!newPrice || newPrice <= 0) return;

                const { positions, challenge } = get();
                const activeChallenge = challenge || DEFAULT_CHALLENGE;
                const challengePositions = activeChallenge.positions || [];

                // 1. Serbest Mod Likidasyon & TP/SL Kontrolü
                if (positions && positions.length > 0) {
                    for (const pos of positions) {
                        if (pos.symbol === symbol && !closingPositionIds.has(pos.id)) {
                            const isLong = pos.side === 'LONG';
                            const isLiq = isLong
                                ? (pos.liquidationPrice > 0 && newPrice <= pos.liquidationPrice)
                                : (pos.liquidationPrice > 0 && newPrice >= pos.liquidationPrice);

                            if (isLiq) {
                                closingPositionIds.add(pos.id);
                                setTimeout(() => get().closePosition(pos.id, newPrice, 'LIQUIDATION'), 0);
                                continue;
                            }

                            if (isLong) {
                                if (pos.takeProfit && newPrice >= pos.takeProfit) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closePosition(pos.id, pos.takeProfit || newPrice, 'TP'), 0);
                                } else if (pos.stopLoss && newPrice <= pos.stopLoss) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closePosition(pos.id, pos.stopLoss || newPrice, 'SL'), 0);
                                }
                            } else {
                                if (pos.takeProfit && newPrice <= pos.takeProfit) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closePosition(pos.id, pos.takeProfit || newPrice, 'TP'), 0);
                                } else if (pos.stopLoss && newPrice >= pos.stopLoss) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closePosition(pos.id, pos.stopLoss || newPrice, 'SL'), 0);
                                }
                            }
                        }
                    }
                }

                // 2. Challenge Mod Likidasyon & TP/SL Kontrolü
                if (challengePositions && challengePositions.length > 0) {
                    for (const pos of challengePositions) {
                        if (pos.symbol === symbol && !closingPositionIds.has(pos.id)) {
                            const isLong = pos.side === 'LONG';
                            const isLiq = isLong
                                ? (pos.liquidationPrice > 0 && newPrice <= pos.liquidationPrice)
                                : (pos.liquidationPrice > 0 && newPrice >= pos.liquidationPrice);

                            if (isLiq) {
                                closingPositionIds.add(pos.id);
                                setTimeout(() => get().closeChallengePosition(pos.id, newPrice, 'LIQUIDATION'), 0);
                                continue;
                            }

                            if (isLong) {
                                if (pos.takeProfit && newPrice >= pos.takeProfit) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closeChallengePosition(pos.id, pos.takeProfit || newPrice, 'TP'), 0);
                                } else if (pos.stopLoss && newPrice <= pos.stopLoss) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closeChallengePosition(pos.id, pos.stopLoss || newPrice, 'SL'), 0);
                                }
                            } else {
                                if (pos.takeProfit && newPrice <= pos.takeProfit) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closeChallengePosition(pos.id, pos.takeProfit || newPrice, 'TP'), 0);
                                } else if (pos.stopLoss && newPrice >= pos.stopLoss) {
                                    closingPositionIds.add(pos.id);
                                    setTimeout(() => get().closeChallengePosition(pos.id, pos.stopLoss || newPrice, 'SL'), 0);
                                }
                            }
                        }
                    }
                }

                // 3. Fiyat güncelleme (Sadece bu sembolde açık pozisyon varsa tetikle, gereksiz re-render'ı önle)
                set((state) => {
                    const currentChallenge = state.challenge || DEFAULT_CHALLENGE;
                    const cPositions = currentChallenge.positions || [];
                    const freePositions = state.positions || [];

                    const hasFreeMatch = freePositions.some((p) => p.symbol === symbol && p.currentPrice !== newPrice);
                    const hasChallengeMatch = cPositions.some((p) => p.symbol === symbol && p.currentPrice !== newPrice);

                    if (!hasFreeMatch && !hasChallengeMatch) {
                        return state;
                    }

                    const updatedFree = hasFreeMatch
                        ? freePositions.map((p) => (p.symbol === symbol ? { ...p, currentPrice: newPrice } : p))
                        : freePositions;

                    const updatedChallengePositions = hasChallengeMatch
                        ? cPositions.map((p) => (p.symbol === symbol ? { ...p, currentPrice: newPrice } : p))
                        : cPositions;

                    const updatedChallenge: ChallengeState = hasChallengeMatch
                        ? { ...currentChallenge, positions: updatedChallengePositions }
                        : currentChallenge;

                    return {
                        positions: updatedFree,
                        challenge: updatedChallenge,
                        challange: updatedChallenge,
                    };
                });
            },
        }),
        {
            name: 'quantsim_trade_store_v1',
            storage: createJSONStorage(() => persistentFileStorage),
            partialize: (state) => ({
                balance: state.balance,
                availableBalance: state.availableBalance,
                positions: state.positions,
                history: state.history,
                hasCustomBalance: state.hasCustomBalance,
                activeMode: state.activeMode,
                currency: state.currency,
                usdTryRate: state.usdTryRate,
                challenge: state.challenge,
                challange: state.challenge,
            }),
            merge: (persistedState: any, currentState: TradeState) => {
                const p = (persistedState as Partial<TradeState>) || {};
                const rawChallenge = p.challenge || (p as any).challange || {};
                const mergedChallenge: ChallengeState = {
                    ...DEFAULT_CHALLENGE,
                    ...rawChallenge,
                    positions: Array.isArray(rawChallenge.positions) ? rawChallenge.positions : [],
                    history: Array.isArray(rawChallenge.history) ? rawChallenge.history : [],
                    currency: (rawChallenge.currency === 'USD' ? 'USD' : 'TRY'),
                    isConfigured: Boolean(rawChallenge.isConfigured),
                };
                return {
                    ...currentState,
                    ...p,
                    challenge: mergedChallenge,
                    challange: mergedChallenge,
                };
            },
            onRehydrateStorage: () => (state) => {
                setTimeout(() => {
                    state?.setHasHydrated(true);
                }, 0);
            },
        }
    )
);