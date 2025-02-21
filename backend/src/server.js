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

wss.on('connection', (ws) => {
    console.log("Client connected");
    const binanceWs = new WebSocket(BINANCE_WS);
    binanceWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const price = parseFloat(data.p);
        priceData.push(price);
        if (priceData.length > 100) priceData.shift();
        
        const indicators = calculateIndicators(priceData);
        const prediction = predictNextPrice({ rsi: indicators.rsi.slice(-1)[0], macd: indicators.macd.slice(-1)[0].MACD, ema: indicators.ema.slice(-1)[0] });
        
        ws.send(JSON.stringify({ price, indicators, prediction }));
    };
});

server.listen(3001, () => console.log('Backend running on port 3001'));
