const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const { calculateIndicators } = require('./indicators');
const { trainModel, predictNextPrice } = require('./model');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const BINANCE_WS = 'wss://ws.coingecko.com/socket.io/?EIO=3&transport=websocket';
let binanceWs;
const priceData = [];
const logs = [];

const log = (message) => {
    console.log(message);
    logs.push(message);
    if (logs.length > 100) logs.shift();
};

// ✅ WebSocket connection for real-time BTC price
const connectWebSocket = () => {
    binanceWs = new WebSocket(BINANCE_WS);

    binanceWs.onopen = () => log('✅ Connected to Binance WebSocket');

    binanceWs.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.p) {
                const price = parseFloat(data.p);
                priceData.push(price);
                if (priceData.length > 100) priceData.shift();
                log(`🔵 WebSocket Price: ${price}`);
            }
        } catch (error) {
            log("❌ Error parsing WebSocket data: " + error.message);
        }
    };

    binanceWs.onerror = (error) => {
        log("❌ WebSocket Error: " + error.message);
    };

    binanceWs.onclose = () => {
        log("⚠️ WebSocket disconnected. Reconnecting in 5 seconds...");
        setTimeout(connectWebSocket, 5000);
    };
};

// ✅ API Fallback if WebSocket fails
const fetchPrice = async () => {
    try {
        const response = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const price = parseFloat(response.data.price);
        priceData.push(price);
        if (priceData.length > 100) priceData.shift();
        log(`🟢 API Fallback Price: ${price}`);
    } catch (error) {
        log(`❌ API Error: ${error.response?.status || error.message}`);
    }
};
setInterval(fetchPrice, 5000);

// ✅ WebSocket connection for clients
wss.on('connection', (ws) => {
    log("🔌 Client connected");
    ws.send(JSON.stringify({ message: "Connected to BTC price stream" }));

    binanceWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.p) {
            const price = parseFloat(data.p);
            const indicators = calculateIndicators(priceData);
            const prediction = predictNextPrice({
                rsi: indicators.rsi.slice(-1)[0],
                macd: indicators.macd.slice(-1)[0].MACD,
                ema: indicators.ema.slice(-1)[0]
            });
            ws.send(JSON.stringify({ price, indicators, prediction }));
        }
    };
});

// ✅ API to fetch latest BTC price & predictions
app.get("/btc-price", (req, res) => {
    if (priceData.length === 0) {
        return res.json({ error: "No data available yet" });
    }
    const indicators = calculateIndicators(priceData);
    const prediction = predictNextPrice({
        rsi: indicators.rsi.slice(-1)[0],
        macd: indicators.macd.slice(-1)[0].MACD,
        ema: indicators.ema.slice(-1)[0]
    });
    res.json({ latestPrice: priceData.slice(-1)[0], indicators, prediction });
});

// ✅ API to fetch server logs for debugging
app.get("/logs", (req, res) => {
    res.json({ logs });
});

// ✅ Root confirmation
app.get("/", (req, res) => {
    res.send("Backend is working! 🚀");
});

// Start WebSocket & server
connectWebSocket();
server.listen(3001, () => log('🚀 Backend running on port 3001'));
