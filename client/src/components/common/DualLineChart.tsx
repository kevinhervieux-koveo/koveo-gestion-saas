import { Line } from 'recharts';

interface DualLineProps {
  dataKey: string;
  color: string;
  chartData: Array<Record<string, any> & { isFuture?: boolean }>;
  includeTransition?: boolean;
  name?: string;
  futureName?: string;
}

export function renderDualLine({
  dataKey,
  color,
  chartData,
  includeTransition = true,
  name,
  futureName,
}: DualLineProps) {
  const pastData = chartData.map((d, idx) => {
    if (d.isFuture) {
      if (includeTransition) {
        const prevPoint = chartData[idx - 1];
        if (!prevPoint || !prevPoint.isFuture) return d;
      }
      return { ...d, [dataKey]: null };
    }
    return d;
  });

  const futureData = chartData.map((d) => {
    if (!d.isFuture) return { ...d, [dataKey]: null };
    return d;
  });

  return (
    <>
      <Line
        type="monotone"
        dataKey={dataKey}
        stroke={color}
        strokeWidth={2}
        dot={(props: any) => {
          const { cx, cy, index } = props;
          const point = chartData[index];
          if (point?.isFuture) return <g key={`${dataKey}-past-${index}`} />;
          return <circle key={`${dataKey}-past-${index}`} cx={cx} cy={cy} r={4} fill={color} strokeWidth={2} />;
        }}
        data={pastData}
        connectNulls
        name={name || dataKey}
      />
      <Line
        type="monotone"
        dataKey={dataKey}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="5 5"
        dot={(props: any) => {
          const { cx, cy, index } = props;
          const point = chartData[index];
          if (!point?.isFuture) return <g key={`${dataKey}-future-${index}`} />;
          return <circle key={`${dataKey}-future-${index}`} cx={cx} cy={cy} r={4} fill={color} strokeWidth={2} />;
        }}
        data={futureData}
        connectNulls
        name={futureName || `${name || dataKey} - Future`}
      />
    </>
  );
}
