"use client";
import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

interface ChartDataPoint {
  date: string;
  [key: string]: number | string;
}

interface Props {
  data: ChartDataPoint[];
  dataKey: string;
  color: string;
  label: string;
}

const ResponsiveBarChart: React.FC<Props> = ({ data, dataKey, color, label }) => (
  <ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip formatter={(value) => `$${value}`} />
      <Legend />
      <Bar dataKey={dataKey} name={label} fill={color} />
    </BarChart>
  </ResponsiveContainer>
);

export default ResponsiveBarChart; 