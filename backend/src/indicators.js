const { RSI, MACD, EMA } = require('technicalindicators');

function calculateIndicators(priceData) {
    return {
        rsi: RSI.calculate({ values: priceData, period: 14 }),
        macd: MACD.calculate({ values: priceData, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }),
        ema: EMA.calculate({ values: priceData, period: 20 })
    };
}

module.exports = { calculateIndicators };
