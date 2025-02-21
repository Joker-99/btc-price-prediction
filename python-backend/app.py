from flask import Flask, jsonify
from flask_socketio import SocketIO
import eventlet
import requests
import numpy as np
import pandas as pd
import ta
from keras.models import Sequential
from keras.layers import Dense, LSTM

app = Flask(__name__)
socketio = SocketIO(app, async_mode='eventlet')
price_data = []
model = None

def fetch_price():
    response = requests.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')
    data = response.json()
    return float(data['price'])

def calculate_indicators(prices):
    df = pd.DataFrame(prices, columns=['price'])
    df['rsi'] = ta.momentum.RSIIndicator(df['price']).rsi()
    df['macd'] = ta.trend.MACD(df['price']).macd()
    df['ema'] = ta.trend.EMAIndicator(df['price']).ema_indicator()
    return df.iloc[-1].to_dict()

def train_model(prices):
    global model
    X = []
    y = []
    for i in range(60, len(prices)):
        X.append(prices[i-60:i])
        y.append(prices[i])
    X, y = np.array(X), np.array(y)
    X = np.reshape(X, (X.shape[0], X.shape[1], 1))
    model = Sequential()
    model.add(LSTM(units=50, return_sequences=True, input_shape=(X.shape[1], 1)))
    model.add(LSTM(units=50))
    model.add(Dense(1))
    model.compile(optimizer='adam', loss='mean_squared_error')
    model.fit(X, y, epochs=1, batch_size=1)

def predict_price(prices):
    if model is None or len(prices) < 60:
        return None
    last_60_prices = np.array(prices[-60:])
    last_60_prices = np.reshape(last_60_prices, (1, last_60_prices.shape[0], 1))
    prediction = model.predict(last_60_prices)
    return prediction[0][0]

@app.route('/btc-price', methods=['GET'])
def btc_price():
    if not price_data:
        return jsonify({'error': 'No data available yet'})
    indicators = calculate_indicators(price_data)
    prediction = predict_price(price_data)
    return jsonify({
        'latestPrice': price_data[-1],
        'indicators': indicators,
        'prediction': prediction
    })

@app.route('/logs', methods=['GET'])
def logs():
    return jsonify({'logs': []})  # Implement log collection as needed

@socketio.on('connect')
def handle_connect():
    print('Client connected')

def price_updater():
    while True:
        price = fetch_price()
        price_data.append(price)
        if len(price_data) > 100:
            price_data.pop(0)
        indicators = calculate_indicators(price_data)
        prediction = predict_price(price_data)
        socketio.emit('price_update', {
            'price': price,
            'indicators': indicators,
            'prediction': prediction
        })
        eventlet.sleep(5)

if __name__ == '__main__':
    eventlet.spawn(price_updater)
    socketio.run(app, host='0.0.0.0', port=5000)
