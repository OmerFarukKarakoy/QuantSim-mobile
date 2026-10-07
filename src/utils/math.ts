// src/utils/math.ts

const DEFAULT_MMR = 0.004; // %0.4 Sürdürme Teminat Oranı

// 1. Likidasyon Fiyatı Hesaplama (İzole ve Çapraz Marjin Desteği)
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: 'LONG' | 'SHORT',
  marginMode: 'CROSS' | 'ISOLATED' = 'ISOLATED',
  extraWalletBalance: number = 0,
  amount: number = 0,
  mmr: number = DEFAULT_MMR
): number {
  const price = Number(entryPrice);
  const lev = Number(leverage);
  const qty = Number(amount);
  const extraBal = Math.max(0, Number(extraWalletBalance));

  if (price <= 0 || lev <= 0) return 0;

  // İzole (Isolated) Marjin: Sadece pozisyona bağlanan marjin teminattır
  if (marginMode === 'ISOLATED' || extraBal <= 0 || qty <= 0) {
    if (side === 'LONG') {
      if (lev === 1) return 0;
      const liq = price * (1 - 1 / lev + mmr);
      return Math.max(0, liq);
    } else {
      const liq = price * (1 + 1 / lev - mmr);
      return Math.max(0, liq);
    }
  }

  // Çapraz (Cross) Marjin: Pozisyon marjini + Cüzdandaki serbest bakiye toplam teminat havuzunu oluşturur
  const initialMargin = (price * qty) / lev;
  const totalCollateral = initialMargin + extraBal;
  const maxAdverseLoss = totalCollateral - (price * qty * mmr);
  const deltaPrice = maxAdverseLoss / qty;

  if (side === 'LONG') {
    const crossLiq = price - deltaPrice;
    return Math.max(0, crossLiq);
  } else {
    const crossLiq = price + deltaPrice;
    return Math.max(0, crossLiq);
  }
}

// 2. Gerçekleşmemiş PnL Hesaplama
export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  amount: number,
  side: 'LONG' | 'SHORT'
): number {
  const entry = Number(entryPrice);
  const current = Number(currentPrice);
  const qty = Number(amount);

  return side === 'LONG' ? (current - entry) * qty : (entry - current) * qty;
}

// 3. ROE (Getiri Yüzdesi) Hesaplama
export function calculateROE(pnl: number, margin: number): number {
  if (!margin || margin === 0) return 0;
  return (Number(pnl) / Number(margin)) * 100;
}