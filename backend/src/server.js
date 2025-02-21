const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const { calculateIndicators } = require('./indicators');
const { trainModel, predictNextPrice } = require('./model');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const BINANCE_WS = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
const priceData = [];
let binanceWs;

// ✅ Function to start WebSocket connection
const connectWebSocket = () => {
    binanceWs = new WebSocket(BINANCE_WS);

    binanceWs.onopen = () => console.log('Connected to Binance WebSocket ✅');

    binanceWs.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.p) {
                const price = parseFloat(data.p);
                priceData.push(price);
                if (priceData.length > 100) priceData.shift();
                console.log(`Received BTC Price: ${price}`);
            } else {
                console.warn("Unexpected WebSocket data:", data);
            }
        } catch (error) {
            console.error("Error parsing WebSocket data:", error.message);
        }
    };

    binanceWs.onerror = (error) => {
        console.error("WebSocket Error:", error.message);
    };

    binanceWs.onclose = () => {
        console.warn("WebSocket disconnected. Reconnecting in 5 seconds...");
        setTimeout(connectWebSocket, 5000);
    };
};

// ✅ Fallback: Fetch BTC price from Binance API every 5 seconds if WebSocket fails
const fetchPrice = async () => {
    try {
        const response = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
        const price = parseFloat(response.data.price);
        priceData.push(price);
        if (priceData.length > 100) priceData.shift();
        console.log(`Fetched BTC Price (Fallback): ${price}`);
    } catch (error) {
        console.error("Error fetching BTC price:", error.message);
    }
};
setInterval(fetchPrice, 5000);

// ✅ WebSocket connection for real-time updates
wss.on('connection', (ws) => {
    console.log("Client connected");

    ws.send(JSON.stringify({ message: "Connected to BTC price stream" }));

    binanceWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p);

        const indicators = calculateIndicators(priceData);
        const prediction = predictNextPrice({
            rsi: indicators.rsi.slice(-1)[0],
            macd: indicators.macd.slice(-1)[0].MACD,
            ema: indicators.ema.slice(-1)[0]
        });

        ws.send(JSON.stringify({ price, indicators, prediction }));
    };
});

// ✅ HTTP API to fetch latest BTC price & predictions
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

    res.json({
        latestPrice: priceData.slice(-1)[0],
        indicators,
        prediction
    });
});

// ✅ Root route confirmation
app.get("/", (req, res) => {
    res.send("Backend is working! 🚀");
});

// Start WebSocket & server
connectWebSocket();
server.listen(3001, () => console.log('Backend running on port 3001'));
