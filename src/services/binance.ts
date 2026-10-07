// src/services/binance.ts

// 1. API Anahtarları (Binance Futures Testnet)
const API_KEY = '****************************************************************';
const SECRET_KEY = '****************************************************************';

// Testnet Base URL'leri (İmzalı işlemler için testnet, canlı piyasa verileri için ana ağ)
const TESTNET_REST_URL = 'https://testnet.binancefuture.com';
const MAINNET_REST_URL = 'https://fapi.binance.com';
const BASE_REST_URL = TESTNET_REST_URL;
const BASE_WS_URL = 'wss://fstream.binance.com/ws';

export interface BinanceSymbol {
    symbol: string;
    baseAsset: string;
    quoteAsset: string;
    pricePrecision: number;
    quantityPrecision: number;
}

export interface BinanceAccountInfo {
    totalWalletBalance: number;
    availableBalance: number;
    totalUnrealizedProfit: number;
}

// HMAC-SHA256 İmza Oluşturucu (Saf JS)
function hmacSha256(message: string, secret: string): string {
    function rightRotate(value: number, amount: number) {
        return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const words: number[] = [];
    const messageLength = message.length * 8;

    let hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let key = secret;
    if (key.length > 64) {
        // SHA256 of key if longer than 64
        let hKey = '';
        // Basit anahtar işleme
        key = key.slice(0, 64);
    }
    const keyPad = key.padEnd(64, '\0');
    const oKeyPad = [];
    const iKeyPad = [];

    for (let i = 0; i < 64; i++) {
        const code = keyPad.charCodeAt(i);
        oKeyPad.push(code ^ 0x5c);
        iKeyPad.push(code ^ 0x36);
    }

    // SHA256 Implementation
    function sha256Raw(inputStr: string): string {
        const w: number[] = [];
        let lHash = [...hash];
        const msg = inputStr;
        const lMsgLen = msg.length * 8;
        const wordsArr: number[] = [];

        for (let i = 0; i < msg.length; i++) {
            wordsArr[i >> 2] |= (msg.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
        }
        wordsArr[lMsgLen >> 5] |= 0x80 << (24 - (lMsgLen % 32));
        wordsArr[(((lMsgLen + 64) >> 9) << 4) + 15] = lMsgLen;

        for (let i = 0; i < wordsArr.length; i += 16) {
            const oldHash = [...lHash];
            for (let j = 0; j < 64; j++) {
                if (j < 16) {
                    w[j] = wordsArr[i + j] | 0;
                } else {
                    const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
                    const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
                    w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
                }

                const ch = (lHash[4] & lHash[5]) ^ (~lHash[4] & lHash[6]);
                const maj = (lHash[0] & lHash[1]) ^ (lHash[0] & lHash[2]) ^ (lHash[1] & lHash[2]);
                const sigma0 = rightRotate(lHash[0], 2) ^ rightRotate(lHash[0], 13) ^ rightRotate(lHash[0], 22);
                const sigma1 = rightRotate(lHash[4], 6) ^ rightRotate(lHash[4], 11) ^ rightRotate(lHash[4], 25);
                const temp1 = (lHash[7] + sigma1 + ch + k[j] + w[j]) | 0;
                const temp2 = (sigma0 + maj) | 0;

                lHash[7] = lHash[6];
                lHash[6] = lHash[5];
                lHash[5] = lHash[4];
                lHash[4] = (lHash[3] + temp1) | 0;
                lHash[3] = lHash[2];
                lHash[2] = lHash[1];
                lHash[1] = lHash[0];
                lHash[0] = (temp1 + temp2) | 0;
            }
            for (let j = 0; j < 8; j++) {
                lHash[j] = (lHash[j] + oldHash[j]) | 0;
            }
        }

        return lHash
            .map((val) => ('00000000' + (val >>> 0).toString(16)).slice(-8))
            .join('');
    }

    // Inner & Outer Key Pass
    const innerMsg = String.fromCharCode(...iKeyPad) + message;
    const innerHashHex = sha256Raw(innerMsg);

    let innerHashStr = '';
    for (let i = 0; i < innerHashHex.length; i += 2) {
        innerHashStr += String.fromCharCode(parseInt(innerHashHex.substr(i, 2), 16));
    }

    const outerMsg = String.fromCharCode(...oKeyPad) + innerHashStr;
    return sha256Raw(outerMsg);
}

/**
 * 2. Binance Testnet Gerçek Bakiye Sorgulama (Signed Endpoint)
 */
export async function fetchAccountBalance(): Promise<BinanceAccountInfo | null> {
    try {
        const timestamp = Date.now();
        const queryString = `timestamp=${timestamp}`;
        const signature = hmacSha256(queryString, SECRET_KEY);

        const response = await fetch(`${BASE_REST_URL}/fapi/v2/account?${queryString}&signature=${signature}`, {
            headers: {
                'X-MBX-APIKEY': API_KEY,
            },
        });

        const data = await response.json();
        if (data && data.totalWalletBalance) {
            return {
                totalWalletBalance: parseFloat(data.totalWalletBalance),
                availableBalance: parseFloat(data.availableBalance),
                totalUnrealizedProfit: parseFloat(data.totalUnrealizedProfit),
            };
        }
        return null;
    } catch (error) {
        console.error('Binance bakiye çekilemedi:', error);
        return null;
    }
}

/**
 * 3. Binance Testnet'te Gerçek Vadeli Emir Açma (Long / Short)
 */
export async function placeRealOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number
): Promise<any> {
    try {
        const timestamp = Date.now();
        const queryString = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
        const signature = hmacSha256(queryString, SECRET_KEY);

        const response = await fetch(`${BASE_REST_URL}/fapi/v1/order?${queryString}&signature=${signature}`, {
            method: 'POST',
            headers: {
                'X-MBX-APIKEY': API_KEY,
            },
        });

        return await response.json();
    } catch (error) {
        console.warn('Binance Testnet Emir Uyarısı:', error);
        return null;
    }
}

/**
 * 4. Tüm Aktif Sembolleri Çeker
 */
export async function fetchActiveSymbols(): Promise<BinanceSymbol[]> {
    try {
        let res = await fetch(`${MAINNET_REST_URL}/fapi/v1/exchangeInfo`);
        if (!res.ok) {
            res = await fetch(`${TESTNET_REST_URL}/fapi/v1/exchangeInfo`);
        }
        const data = await res.json();

        return data.symbols
            .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT' && (!s.contractType || s.contractType === 'PERPETUAL'))
            .map((s: any) => ({
                symbol: s.symbol,
                baseAsset: s.baseAsset,
                quoteAsset: s.quoteAsset,
                pricePrecision: s.pricePrecision,
                quantityPrecision: s.quantityPrecision,
            }));
    } catch (error) {
        console.error('Binance sembolleri çekilemedi:', error);
        return [];
    }
}

/**
 * 5. Tekil Anlık Fiyat (REST)
 */
export async function fetchCurrentPrice(symbol: string): Promise<number | null> {
    try {
        let res = await fetch(`${MAINNET_REST_URL}/fapi/v1/ticker/price?symbol=${symbol}`);
        if (!res.ok) {
            res = await fetch(`${TESTNET_REST_URL}/fapi/v1/ticker/price?symbol=${symbol}`);
        }
        const data = await res.json();
        return parseFloat(data.price);
    } catch (error) {
        return null;
    }
}

/**
 * 6. Canlı WebSocket Fiyat Akışı (Sıfır Gecikme)
 */
export function subscribeToLivePrice(
    symbol: string,
    onPriceUpdate: (price: number) => void
): () => void {
    const streamName = `${symbol.toLowerCase()}@markPrice@1s`;
    const ws = new WebSocket(`${BASE_WS_URL}/${streamName}`);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data && data.p) {
                onPriceUpdate(parseFloat(data.p));
            }
        } catch (e) {
            // sessizce geç
        }
    };

    return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
    };
}

/**
 * 6b. Birden Fazla Sembol İçin Canlı WebSocket Fiyat Akışı (Pozisyonlar Ekranı İçin)
 */
export function subscribeToMultiplePrices(
    symbols: string[],
    onPriceUpdate: (symbol: string, price: number) => void
): () => void {
    if (!symbols || symbols.length === 0) return () => { };

    // Hem hızlı işlem akışı (@ticker) hem de düzenli fiyat (@markPrice@1s) dinlenir
    const tickerStreams = symbols.map((s) => `${s.toLowerCase()}@ticker`);
    const markStreams = symbols.map((s) => `${s.toLowerCase()}@markPrice@1s`);
    const allStreams = [...tickerStreams, ...markStreams].join('/');

    const ws = new WebSocket(`wss://fstream.binance.com/stream?streams=${allStreams}`);

    ws.onmessage = (event) => {
        try {
            const parsed = JSON.parse(event.data);
            const data = parsed.data || parsed;
            const sym = data.s;
            const priceStr = data.c || data.p;
            if (sym && priceStr) {
                const priceNum = parseFloat(priceStr);
                if (!isNaN(priceNum) && priceNum > 0) {
                    onPriceUpdate(sym, priceNum);
                }
            }
        } catch (e) {
            // sessizce geç
        }
    };

    return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
    };
}

export interface OrderBookEntry {
    price: number;
    amount: number;
    total: number;
}

export interface OrderBookData {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
}

export interface Ticker24hData {
    symbol: string;
    lastPrice: number;
    priceChange: number;
    priceChangePercent: number;
    highPrice: number;
    lowPrice: number;
    volume: number;
    quoteVolume: number;
}

/**
 * 7. 24 Saatlik Ticker Verisi (REST)
 */
export async function fetch24hTicker(symbol: string): Promise<Ticker24hData | null> {
    try {
        let res = await fetch(`${MAINNET_REST_URL}/fapi/v1/ticker/24hr?symbol=${symbol}`);
        if (!res.ok) {
            res = await fetch(`${TESTNET_REST_URL}/fapi/v1/ticker/24hr?symbol=${symbol}`);
        }
        const d = await res.json();
        return {
            symbol: d.symbol,
            lastPrice: parseFloat(d.lastPrice),
            priceChange: parseFloat(d.priceChange),
            priceChangePercent: parseFloat(d.priceChangePercent),
            highPrice: parseFloat(d.highPrice),
            lowPrice: parseFloat(d.lowPrice),
            volume: parseFloat(d.volume),
            quoteVolume: parseFloat(d.quoteVolume),
        };
    } catch (e) {
        return null;
    }
}

/**
 * 8. Canlı Emir Defteri (Order Book / Depth Stream)
 */
export function subscribeToOrderBook(
    symbol: string,
    onDepthUpdate: (data: OrderBookData) => void
): () => void {
    const streamName = `${symbol.toLowerCase()}@depth10@100ms`;
    const ws = new WebSocket(`${BASE_WS_URL}/${streamName}`);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data && data.b && data.a) {
                let bidTotal = 0;
                const bids: OrderBookEntry[] = data.b.slice(0, 7).map((item: [string, string]) => {
                    const price = parseFloat(item[0]);
                    const amount = parseFloat(item[1]);
                    bidTotal += amount;
                    return { price, amount, total: bidTotal };
                });

                let askTotal = 0;
                const asks: OrderBookEntry[] = data.a.slice(0, 7).map((item: [string, string]) => {
                    const price = parseFloat(item[0]);
                    const amount = parseFloat(item[1]);
                    askTotal += amount;
                    return { price, amount, total: askTotal };
                });

                onDepthUpdate({ bids, asks });
            }
        } catch (e) {
            // sessizce geç
        }
    };

    return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
    };
}

export interface KlineCandle {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
}

/**
 * 9. Son Mum Verileri (Klines / Candlesticks)
 */
export async function fetchKlines(
    symbol: string,
    interval: string = '15m',
    limit: number = 50
): Promise<KlineCandle[]> {
    try {
        let res = await fetch(`${MAINNET_REST_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        if (!res.ok) {
            res = await fetch(`${TESTNET_REST_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        }
        if (!res.ok) return [];
        const raw = await res.json();
        if (!Array.isArray(raw)) return [];
        return raw.map((k: any[]) => ({
            openTime: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: k[6],
        }));
    } catch (e) {
        return [];
    }
}

