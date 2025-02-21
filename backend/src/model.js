const brain = require('brain.js');

const net = new brain.NeuralNetwork();

function trainModel(data) {
    net.train(data, { log: true, iterations: 1000 });
}

function predictNextPrice(input) {
    return net.run(input);
}

module.exports = { trainModel, predictNextPrice };
