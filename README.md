# 📈 QuantSim Mobile

![React Native](https://img.shields.io/badge/Frontend-React%20Native-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Framework-Expo-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Zustand](https://img.shields.io/badge/State-Zustand-443e38?style=for-the-badge)
![Binance](https://img.shields.io/badge/Exchange-Binance%20Futures-F0B90B?style=for-the-badge&logo=binance&logoColor=black)
![Platform](https://img.shields.io/badge/Platform-iOS%20%2F%20Android-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**QuantSim Mobile** is a quantitative finance and cryptocurrency trading simulation engine built with React Native (Expo) and TypeScript. 

Designed for algorithmic traders, quants, and finance enthusiasts, the app eliminates the financial risks of early-stage strategy testing by offering an ultra-realistic paper trading environment. By tapping into real-time market data pipelines and low-latency WebSocket streams, QuantSim Mobile replicates high-frequency derivatives trading with zero capital at risk.

✅ **Architecture:** Low-latency state management powered by Zustand and mathematical evaluation utilities  
✅ **Ideal for:** Quantitative Researchers, Algo-Traders, Mobile Engineers, and Portfolio Showcase

---

## 🧠 Overview & Methodology

QuantSim Mobile replicates order execution environments and statistical portfolio analysis:

1. **⚡ Low-Latency Data Streaming:** Connects directly to **Binance Futures WebSockets** and **CoinMarketCap REST APIs** for sub-second mark-price updates and order-book state synchronization.
2. **📐 Mathematical Risk & PnL Engine:** Employs an internal mathematical computation layer (`math.ts`) to model real-world leverage, dynamic margin maintenance, unrealized/realized PnL, and liquidation thresholds.
3. **🎯 Trade Challenges & Analytics:** Tracks quantitative performance metrics over time, analyzing trade distribution, drawdown, win rates, and consistency through integrated analytics modules.

---

## ⚙️ Key Features

- **Live Market Feeds:** Real-time futures ticker and depth streaming via robust WebSocket channels.
- **Position & Margin Management:** Open, close, and adjust positions with customizable leverage and isolated margin limits.
- **Quantitative Challenge Track:** Built-in challenge modes simulating prop trading firm evaluation metrics.
- **In-Depth Performance Analytics:** Visual feedback loops tracking historical performance, PnL charts, and trade execution accuracy.
- **Modern & Reactive UI:** Engineered with Expo Router and custom dark-mode theme components built for financial monitoring.
- **Decoupled Architecture:** Strict separation of networking layers (`services/`), central store (`store/`), and mathematical primitives (`utils/`).

---

## 🖥️ Visual Preview


### 1. Market Dashboard & Live Tickers
*Real-time streaming prices, 24h market performance, and order-book snapshots.*

<img width="350" alt="Dashboard" src="https://via.placeholder.com/350x700?text=Dashboard+Preview" />

### 2. Active Positions & Leverage Controls
*Execution terminal showing live PnL, entry targets, liquidation prices, and margin ratios.*

<img width="350" alt="Positions" src="https://via.placeholder.com/350x700?text=Positions+Preview" />

### 3. Quantitative Analytics & Performance
*Detailed drawdown graphs, risk distribution metrics, and trade execution reports.*

<img width="350" alt="Analytics" src="https://via.placeholder.com/350x700?text=Analytics+Preview" />

### 4. Challenge & Evaluation Terminal
*Evaluation tracks monitoring rule adherence, daily loss limits, and profit targets.*

<img width="350" alt="Challenge" src="https://via.placeholder.com/350x700?text=Challenge+Preview" />

---

## 🧰 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Mobile Framework** | React Native / Expo | Cross-platform runtime and native routing (`expo-router`) |
| **Language** | TypeScript | End-to-end type safety for trading engines and state |
| **State Management** | Zustand | Atomic, low-overhead global trading store (`useTradeStore`) |
| **Market Feeds** | Binance Futures API / WebSocket | Low-latency order book and mark-price streaming |
| **Data Provider** | CoinMarketCap API | Macro cryptocurrency metrics and token details |
| **Mathematical Engine** | Custom TypeScript Math Lib | Leverage, margin, and liquidation calculations (`math.ts`) |

---

## Get started
1. Clone the repository
   
   ```bash
   git clone [https://github.com/OmerFarukKarakoy/QuantSim-mobile.git](https://github.com/OmerFarukKarakoy/QuantSim-mobile.git)
   cd QuantSim-mobile
   ```
   
2. Install dependencies

   ```bash
   npm install
   ```

3. Configure Environment Variables
Create a .env file in the project root:

   ```bash
   EXPO_PUBLIC_CMC_API_KEY=your_coinmarketcap_api_key
   EXPO_PUBLIC_BINANCE_API_KEY=your_binance_testnet_key
   EXPO_PUBLIC_BINANCE_SECRET_KEY=your_binance_testnet_secret
   ```

4. Run on Local Emulator / Expo Go
   Start the app

   ```bash
   npx expo start
   ```
Press a to launch on Android Emulator / Device.
Press i to launch on iOS Simulator.
Scan the terminal QR code using Expo Go.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.


## 👨‍💻 Developer

**Ömer Faruk Karaköy**    
🌐 GitHub: [github.com/OmerFarukKarakoy](https://github.com/OmerFarukKarakoy)  
📧 Mail: omerfarukkarakoy@hotmail.com


## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
