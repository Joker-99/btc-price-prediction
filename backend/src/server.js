const express = require('express');
const axios = require('axios');
const WebSocket = require('ws');
const { calculateIndicators } = require('./indicators');
const { trainModel, predictNextPrice } = require('./model');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const BINANCE_WS = 'wss://stream.binance.com:9443/ws/btcusdt@trade';
let priceData = [];

// WebSocket connection
wss.on('connection', (ws) => {
    console.log("Client connected");
    const binanceWs = new WebSocket(BINANCE_WS);
    
    binanceWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p);
        priceData.push(price);
        if (priceData.length > 100) priceData.shift();
        
        const indicators = calculateIndicators(priceData);
        const prediction = predictNextPrice({ 
            rsi: indicators.rsi.slice(-1)[0], 
            macd: indicators.macd.slice(-1)[0].MACD, 
            ema: indicators.ema.slice(-1)[0] 
        });

        ws.send(JSON.stringify({ price, indicators, prediction }));
    };
});

// ✅ Serve HTTP request at "/"
app.get("/", (req, res) => {
    res.send("Backend is working! 🚀");
});

// ✅ Serve BTC price & prediction over HTTP
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

// Start server
server.listen(3001, () => console.log('Backend running on port 3001'));
