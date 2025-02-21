import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const Chart = ({ data }) => {
    return (
        <LineChart width={600} height={300} data={data}>
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="price" stroke="#8884d8" />
        </LineChart>
    );
};
export default Chart;
