import { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/format';

interface HeatmapDataPoint {
  date: string;
  amount: number;
}

interface SpendingHeatmapProps {
  data: HeatmapDataPoint[];
}

interface DayCell {
  date: string;
  amount: number;
  dayOfWeek: number;
  weekIndex: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VISIBLE_DAY_LABELS = [1, 3, 5]; // Mon, Wed, Fri

function getColorClass(amount: number, max: number): string {
  if (amount === 0 || max === 0) {
    return 'bg-surface-100 dark:bg-surface-800';
  }
  const ratio = amount / max;
  if (ratio <= 0.2) return 'bg-primary-100 dark:bg-primary-900';
  if (ratio <= 0.4) return 'bg-primary-200 dark:bg-primary-800';
  if (ratio <= 0.6) return 'bg-primary-300 dark:bg-primary-700';
  if (ratio <= 0.8) return 'bg-primary-400 dark:bg-primary-600';
  return 'bg-primary-500 dark:bg-primary-500';
}

function getLegendClasses(): string[] {
  return [
    'bg-surface-100 dark:bg-surface-800',
    'bg-primary-100 dark:bg-primary-900',
    'bg-primary-200 dark:bg-primary-800',
    'bg-primary-300 dark:bg-primary-700',
    'bg-primary-400 dark:bg-primary-600',
    'bg-primary-500 dark:bg-primary-500',
  ];
}

export default function SpendingHeatmap({ data }: SpendingHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; amount: number } | null>(null);

  const { grid, monthLabels, maxAmount } = useMemo(() => {
    // Build a map of date -> amount
    const dateMap = new Map<string, number>();
    for (const d of data) {
      dateMap.set(d.date, (dateMap.get(d.date) || 0) + d.amount);
    }

    // Calculate the 52-week range ending today
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 363); // ~52 weeks

    // Adjust start to the beginning of the week (Sunday)
    const startDow = startDate.getDay();
    if (startDow !== 0) {
      startDate.setDate(startDate.getDate() - startDow);
    }

    const cells: DayCell[] = [];
    let max = 0;
    const current = new Date(startDate);
    let weekIdx = 0;

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const amount = dateMap.get(dateStr) || 0;
      if (amount > max) max = amount;

      cells.push({
        date: dateStr,
        amount,
        dayOfWeek: current.getDay(),
        weekIndex: weekIdx,
      });

      current.setDate(current.getDate() + 1);
      if (current.getDay() === 0 && current <= endDate) {
        weekIdx++;
      }
    }

    // Build month labels with positions
    const months: { label: string; weekIndex: number }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastMonth = -1;

    for (const cell of cells) {
      const d = new Date(cell.date + 'T00:00:00');
      const m = d.getMonth();
      if (m !== lastMonth && cell.dayOfWeek <= 3) {
        months.push({ label: monthNames[m], weekIndex: cell.weekIndex });
        lastMonth = m;
      }
    }

    // Group cells by week
    const totalWeeks = weekIdx + 1;
    const weekGrid: (DayCell | null)[][] = Array.from({ length: totalWeeks }, () =>
      Array.from({ length: 7 }, () => null)
    );

    for (const cell of cells) {
      weekGrid[cell.weekIndex][cell.dayOfWeek] = cell;
    }

    return { grid: weekGrid, monthLabels: months, maxAmount: max };
  }, [data]);

  const handleMouseEnter = (e: React.MouseEvent, cell: DayCell) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const container = e.currentTarget.closest('.heatmap-container')?.getBoundingClientRect();
    if (container) {
      setTooltip({
        x: rect.left - container.left + rect.width / 2,
        y: rect.top - container.top - 8,
        date: cell.date,
        amount: cell.amount,
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="relative heatmap-container">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 px-3 py-2 text-xs font-medium bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold">{formatDate(tooltip.date)}</div>
          <div>{tooltip.amount > 0 ? formatCurrency(tooltip.amount) : 'No spending'}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1 min-w-fit">
          {/* Month labels */}
          <div className="flex ml-8">
            {monthLabels.map((m, i) => (
              <div
                key={`${m.label}-${i}`}
                className="text-xs text-surface-500 dark:text-surface-400"
                style={{
                  position: 'relative',
                  left: `${m.weekIndex * 14}px`,
                  marginRight: i < monthLabels.length - 1
                    ? `${Math.max(0, (monthLabels[i + 1].weekIndex - m.weekIndex) * 14 - 24)}px`
                    : 0,
                  width: '24px',
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex gap-0">
            {/* Day labels */}
            <div className="flex flex-col gap-[3px] mr-1 justify-start">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="h-[11px] flex items-center justify-end pr-1"
                >
                  <span className="text-[10px] text-surface-500 dark:text-surface-400 leading-none">
                    {VISIBLE_DAY_LABELS.includes(i) ? label : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div className="flex gap-[3px]">
              {grid.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-[3px]">
                  {week.map((cell, dayIdx) => (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className={`w-[11px] h-[11px] rounded-sm transition-colors cursor-pointer ${
                        cell ? getColorClass(cell.amount, maxAmount) : 'bg-transparent'
                      }`}
                      onMouseEnter={cell ? (e) => handleMouseEnter(e, cell) : undefined}
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-2 ml-8">
            <span className="text-xs text-surface-500 dark:text-surface-400">Less</span>
            {getLegendClasses().map((cls, i) => (
              <div
                key={i}
                className={`w-[11px] h-[11px] rounded-sm ${cls}`}
              />
            ))}
            <span className="text-xs text-surface-500 dark:text-surface-400">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
