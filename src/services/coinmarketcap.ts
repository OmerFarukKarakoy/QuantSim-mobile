export interface GlobalMarketData {
  totalMarketCapUsd: number;
  totalMarketCapChange24h: number;
  totalVolume24hUsd: number;
  totalVolumeChange24h: number;
  btcDominance: number;
  btcDominanceChange24h: number;
  ethDominance: number;
  ethDominanceChange24h: number;
  activeCryptocurrencies: number;
  fearAndGreedValue: number;
  fearAndGreedClassification: string;
}

const CMC_API_KEY = process.env.EXPO_PUBLIC_CMC_API_KEY || '';
const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com';

export const DEFAULT_GLOBAL_MARKET_DATA: GlobalMarketData = {
  totalMarketCapUsd: 2280000000000,
  totalMarketCapChange24h: 1.25,
  totalVolume24hUsd: 64800000000,
  totalVolumeChange24h: -3.40,
  btcDominance: 57.6,
  btcDominanceChange24h: 0.18,
  ethDominance: 13.4,
  ethDominanceChange24h: -0.05,
  activeCryptocurrencies: 10450,
  fearAndGreedValue: 61,
  fearAndGreedClassification: 'Açgözlülük',
};

/**
 * Fear & Greed sınıflandırmasını Türkçe'ye çevirir
 */
export function translateFearGreed(classification: string): string {
  const lower = classification.toLowerCase();
  if (lower.includes('extreme greed')) return 'Aşırı Açgözlülük';
  if (lower.includes('greed')) return 'Açgözlülük';
  if (lower.includes('extreme fear')) return 'Aşırı Korku';
  if (lower.includes('fear')) return 'Korku';
  if (lower.includes('neutral')) return 'Nötr';
  return classification;
}

/**
 * CoinMarketCap API'sinden Global Kripto Piyasası verilerini çeker
 */
export async function fetchGlobalMarketData(): Promise<GlobalMarketData> {
  let result: GlobalMarketData = { ...DEFAULT_GLOBAL_MARKET_DATA };

  // 1. CoinMarketCap Global Metrics
  try {
    const res = await fetch(`${CMC_BASE_URL}/v1/global-metrics/quotes/latest`, {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': CMC_API_KEY,
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const json = await res.json();
      const d = json?.data;
      const usdQuote = d?.quote?.USD;

      if (usdQuote) {
        result.totalMarketCapUsd = usdQuote.total_market_cap ?? result.totalMarketCapUsd;
        result.totalMarketCapChange24h =
          usdQuote.total_market_cap_yesterday_percentage_change ?? result.totalMarketCapChange24h;
        result.totalVolume24hUsd = usdQuote.total_volume_24h ?? result.totalVolume24hUsd;
        result.totalVolumeChange24h =
          usdQuote.total_volume_24h_yesterday_percentage_change ?? result.totalVolumeChange24h;
      }

      if (d) {
        result.btcDominance = d.btc_dominance ?? result.btcDominance;
        result.btcDominanceChange24h = d.btc_dominance_24h_percentage_change ?? 0;
        result.ethDominance = d.eth_dominance ?? result.ethDominance;
        result.ethDominanceChange24h = d.eth_dominance_24h_percentage_change ?? 0;
        result.activeCryptocurrencies = d.active_cryptocurrencies ?? result.activeCryptocurrencies;
      }
    } else {
      console.warn('CMC Global Metrics API response not ok:', res.status);
    }
  } catch (error) {
    console.warn('Error fetching CMC Global Metrics:', error);
  }

  // 2. Fear & Greed verisi (Önce CMC v3 endpoint'i, gerekirse Alternative.me fallback)
  try {
    let fngLoaded = false;

    // CMC v3 Fear and Greed
    try {
      const cmcFngRes = await fetch(`${CMC_BASE_URL}/v3/fear-and-greed/latest`, {
        method: 'GET',
        headers: {
          'X-CMC_PRO_API_KEY': CMC_API_KEY,
          Accept: 'application/json',
        },
      });
      if (cmcFngRes.ok) {
        const fngJson = await cmcFngRes.json();
        const fngData = fngJson?.data;
        if (fngData && typeof fngData.value === 'number') {
          result.fearAndGreedValue = Math.round(fngData.value);
          result.fearAndGreedClassification = translateFearGreed(
            fngData.value_classification || 'Nötr'
          );
          fngLoaded = true;
        }
      }
    } catch {
      // Devam et, fallback denenecek
    }

    // Alternative.me fallback
    if (!fngLoaded) {
      const fngRes = await fetch('https://api.alternative.me/fng/?limit=1');
      if (fngRes.ok) {
        const fngJson = await fngRes.json();
        const item = fngJson?.data?.[0];
        if (item) {
          result.fearAndGreedValue = parseInt(item.value, 10) || result.fearAndGreedValue;
          result.fearAndGreedClassification = translateFearGreed(
            item.value_classification || 'Nötr'
          );
        }
      }
    }
  } catch (fngErr) {
    console.warn('Error fetching Fear & Greed:', fngErr);
  }

  return result;
}

/**
 * Sayıyı Trilyon, Milyar veya Milyon olarak biçimlendirir
 */
export function formatCompactCurrency(val: number, currency: 'TRY' | 'USD', rate: number = 1): string {
  const converted = currency === 'TRY' ? val * rate : val;
  const symbol = currency === 'TRY' ? '₺' : '$';

  if (converted >= 1e12) {
    return `${symbol}${(converted / 1e12).toFixed(2)} Trilyon ${currency}`;
  }
  if (converted >= 1e9) {
    return `${symbol}${(converted / 1e9).toFixed(2)} Milyar ${currency}`;
  }
  if (converted >= 1e6) {
    return `${symbol}${(converted / 1e6).toFixed(2)} Milyon ${currency}`;
  }
  return `${symbol}${converted.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ${currency}`;
}
