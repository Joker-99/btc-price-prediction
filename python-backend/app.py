import json
import eventlet
import requests
import numpy as np
import pandas as pd
import tensorflow as tf
import flask
import flask_socketio
from ta.momentum import RSIIndicator
from ta.trend import MACD, EMAIndicator
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, LSTM

eventlet.monkey_patch()

# Flask Setup
app = flask.Flask(__name__)
socketio = flask_socketio.SocketIO(app, cors_allowed_origins="*")

# Binance WebSocket URL
BINANCE_WS = "wss://stream.binance.com:9443/ws/btcusdt@trade"
price_data = []

# Fetch price from Binance REST API (fallback if WebSocket fails)
def fetch_price():
    try:
        response = requests.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
        price = float(response.json()["price"])
        return price
    except Exception as e:
        print("API Error:", str(e))
        return None

# WebSocket Handler for Live Data
def start_websocket():
    from websocket import WebSocketApp
    
    def on_message(ws, message):
        global price_data
        data = json.loads(message)
        price = float(data["p"])
        price_data.append(price)
        if len(price_data) > 100:
            price_data.pop(0)
        socketio.emit("btc_price", {"price": price})
    
    ws = WebSocketApp(BINANCE_WS, on_message=on_message)
    ws.run_forever()

# Run WebSocket in the background
eventlet.spawn(start_websocket)

# Calculate Indicators
def calculate_indicators():
    df = pd.DataFrame(price_data, columns=["close"])
    df["rsi"] = RSIIndicator(df["close"]).rsi()
    df["macd"] = MACD(df["close"]).macd()
    df["ema"] = EMAIndicator(df["close"], window=14).ema_indicator()
    return df.iloc[-1].to_dict()

# API Route for Price Data
@app.route("/btc-price")
def btc_price():
    if not price_data:
        return flask.jsonify({"error": "No data available yet"})
    
    indicators = calculate_indicators()
    return flask.jsonify({"price": price_data[-1], "indicators": indicators})

# API Route for WebSocket Logs
@app.route("/logs")
def logs():
    return flask.jsonify({"message": "WebSocket running on Binance"})

# Start Flask App
if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
