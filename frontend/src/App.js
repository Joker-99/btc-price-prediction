import React, { useEffect, useState } from 'react';
import Chart from './Chart';

const App = () => {
    const [price, setPrice] = useState(0);
    useEffect(() => {
        const ws = new WebSocket('ws://localhost:3001');
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setPrice(data.price);
        };
        return () => ws.close();
    }, []);
    return (
        <div>
            <h1>BTC Price: {price}</h1>
            <Chart />
        </div>
    );
};
export default App;
