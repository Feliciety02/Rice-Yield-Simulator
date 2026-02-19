interface LegendItem {
  label: string;
  color: string;
  variant?: 'line' | 'fill';
}

export default function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div
      className="mt-3 flex flex-wrap gap-4 text-xs font-medium text-foreground"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-2">
          <span
            className={
              item.variant === 'line'
                ? 'h-0.5 w-6 rounded-full'
                : 'h-2.5 w-2.5 rounded-sm'
            }
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
