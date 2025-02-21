const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const { calculateIndicators } = require('./indicators');
const { trainModel, predictNextPrice } = require('./model');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const BINANCE_WS = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
const PROXY_WS = 'wss://api.proxyscrape.com/ws?url=wss://stream.binance.com:9443/ws/btcusdt@trade';

// Use Proxy if Binance WebSocket is blocked
const binanceWs = new WebSocket(PROXY_WS || BINANCE_WS);

let priceData = [];

binanceWs.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p);
        priceData.push(price);
        if (priceData.length > 100) priceData.shift(); // Keep last 100 prices
    } catch (error) {
        console.error("Error processing WebSocket message:", error);
    }
};

binanceWs.onerror = (error) => {
    console.error("WebSocket Error:", error);
};

binanceWs.onclose = () => {
    console.warn("WebSocket connection closed. Attempting to reconnect...");
    setTimeout(() => {
        binanceWs = new WebSocket(PROXY_WS || BINANCE_WS);
    }, 5000);
};

// WebSocket for real-time updates
wss.on('connection', (ws) => {
    console.log("Client connected");
    ws.send(JSON.stringify({ message: "Connected to BTC price stream" }));
    
    binanceWs.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            const price = parseFloat(data.p);
            
            const indicators = calculateIndicators(priceData);
            const prediction = predictNextPrice({ 
                rsi: indicators.rsi.slice(-1)[0], 
                macd: indicators.macd.slice(-1)[0].MACD, 
                ema: indicators.ema.slice(-1)[0] 
            });
            
            ws.send(JSON.stringify({ price, indicators, prediction }));
        } catch (error) {
            console.error("Error processing WebSocket message:", error);
        }
    };
});

// API Endpoint to get BTC price data
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

// Root route confirmation
app.get("/", (req, res) => {
    res.send("Backend is working! 🚀");
});

// Start server
server.listen(3001, () => console.log('Backend running on port 3001'));
