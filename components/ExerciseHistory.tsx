'use client';
import { useMemo, useState } from 'react';
import { getRecordsByExercise, type Unit } from '@/lib/storage';

type LiveTotals = {
  dateStr: string;
  loadKg: number;
  reps: number;
  sets: number;
};

type Props = {
  exerciseName: string;
  unit: Unit;
  liveTotals?: LiveTotals;
};

type RangeOption = 7 | 30 | 90;

export default function ExerciseHistory({ exerciseName, unit, liveTotals }: Props) {
  const [range, setRange] = useState<RangeOption>(30);

  const records = useMemo(
    () => (exerciseName ? getRecordsByExercise(exerciseName, unit) : []),
    [exerciseName, unit]
  );

  const mergedRecords = useMemo(() => {
    if (!liveTotals) return records;

    // 入力が空に近い場合は無視
    if (
      !liveTotals.dateStr ||
      liveTotals.sets <= 0 ||
      liveTotals.reps <= 0 ||
      liveTotals.loadKg <= 0
    ) {
      return records;
    }

    let replaced = false;
    const list = records.map((r) => {
      if (r.dateStr === liveTotals.dateStr) {
        replaced = true;
        return {
          ...r,
          totals: {
            ...r.totals,
            loadKg: liveTotals.loadKg,
            reps: liveTotals.reps,
            sets: liveTotals.sets,
          },
        };
      }
      return r;
    });

    if (!replaced) {
      list.push({
        id: `live-${liveTotals.dateStr}`,
        dateStr: liveTotals.dateStr,
        totals: {
          loadKg: liveTotals.loadKg,
          reps: liveTotals.reps,
          sets: liveTotals.sets,
        },
      } as any);
    }

    return list;
  }, [records, liveTotals]);

  const limitedRecords = useMemo(() => {
    const list = mergedRecords ?? [];
    if (list.length === 0) return [];

    // 日付順（古い → 新しい）にソート
    const sorted = [...list].sort((a, b) =>
      a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : 0,
    );

    const last = sorted[sorted.length - 1];
    if (!last) return sorted;

    // YYYY-MM-DD 形式の日付を Date に変換
    const lastDate = new Date(last.dateStr);
    if (Number.isNaN(lastDate.getTime())) {
      // パースに失敗したときは単純に全件返す
      return sorted;
    }

    const days = range; // 7 / 30 / 90
    const fromTime = lastDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000;

    const filtered = sorted.filter((r) => {
      const d = new Date(r.dateStr);
      if (Number.isNaN(d.getTime())) return false;
      const t = d.getTime();
      return t >= fromTime && t <= lastDate.getTime();
    });

    return filtered;
  }, [mergedRecords, range]);

  const rangeLabel = useMemo(() => {
    if (limitedRecords.length === 0) return '';
    const start = limitedRecords[0].dateStr;
    const end = limitedRecords[limitedRecords.length - 1].dateStr;
    return `${start} 〜 ${end}`;
  }, [limitedRecords]);

  if (!exerciseName) return null;

  return (
    <section className="rounded-xl border border-white/10 bg-[#1e1e1e] p-4 space-y-3">
      <div className="text-sm opacity-80">過去の記録（{exerciseName} / {unit}）</div>

      {limitedRecords.length === 0 ? (
        <div className="text-xs opacity-70">この種目の保存済みデータはまだありません。</div>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-xs text-white/75">推移</div>
              <div className="flex gap-1 rounded-full bg-white/5 px-1 py-0.5">
                {[7, 30, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRange(d as RangeOption)}
                    className={`px-2 py-0.5 text-[10px] rounded-full border transition ${
                      range === d
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-transparent text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {d === 7 ? '7d' : d === 30 ? '30d' : '90d'}
                  </button>
                ))}
              </div>
            </div>
            {rangeLabel && (
              <div className="text-[10px] text-white/40 tabular-nums">
                {rangeLabel}
              </div>
            )}
          </div>

          {(() => {
            const width = 360, height = 80, padX = 8, padY = 10;
            const ys = limitedRecords.map((r) => r.totals.loadKg);
            if (ys.length === 0) return null;

            const maxY = Math.max(...ys);
            const minY = Math.min(...ys);
            const rangeY = maxY - minY || 1;
            const n = limitedRecords.length;

            // 座標計算
            const points = limitedRecords.map((r, i) => {
              const t = n === 1 ? 0.5 : i / (n - 1);
              const x = padX + (width - padX * 2) * t;
              const norm = (r.totals.loadKg - minY) / rangeY;
              const y = height - padY - norm * (height - padY * 2);
              return { x, y, record: r };
            });

            const last = limitedRecords[n - 1].totals.loadKg;
            const prev = n >= 2 ? limitedRecords[n - 2].totals.loadKg : last;
            const trendingUp = last >= prev;

            const lineColor = trendingUp ? '#34d399' : '#60a5fa'; // emerald / blue
            const areaColor = trendingUp
              ? 'rgba(16,185,129,0.15)'
              : 'rgba(59,130,246,0.15)';

            const startLabel = limitedRecords[0].dateStr.slice(5);
            const endLabel = limitedRecords[n - 1].dateStr.slice(5);

            const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
            const areaPoints = [
              ...points.map((p) => `${p.x},${p.y}`),
              `${points[points.length - 1].x},${height - padY}`,
              `${points[0].x},${height - padY}`,
            ].join(' ');

            return (
              <div className="space-y-1">
                <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="block">
                  <defs>
                    <linearGradient id="volumeLineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={lineColor} stopOpacity="0.5" />
                      <stop offset="100%" stopColor={lineColor} stopOpacity="1" />
                    </linearGradient>
                  </defs>

                  {/* 背景のグリッドライン（水平） */}
                  <line
                    x1={padX}
                    y1={height - padY}
                    x2={width - padX}
                    y2={height - padY}
                    stroke="rgba(148,163,184,0.35)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />

                  {/* 塗りつぶしエリア */}
                  <polyline
                    fill={areaColor}
                    stroke="none"
                    points={areaPoints}
                  />

                  {/* メインの折れ線 */}
                  <polyline
                    fill="none"
                    stroke="url(#volumeLineGradient)"
                    strokeWidth="2"
                    points={linePoints}
                  />

                  {/* 各ポイントのマーカー（最新だけ少し大きく） */}
                  {points.map((p, i) => {
                    const isLast = i === points.length - 1;
                    return (
                      <circle
                        key={p.record.dateStr}
                        cx={p.x}
                        cy={p.y}
                        r={isLast ? 3.2 : 2}
                        fill={isLast ? '#22c55e' : '#e5e7eb'}
                        fillOpacity={isLast ? 1 : 0.9}
                      />
                    );
                  })}
                </svg>
                <div className="flex justify-between text-[10px] text-white/45 tabular-nums">
                  <span>{startLabel}</span>
                  <span>{endLabel}</span>
                </div>
              </div>
            );
          })()}

          {/* --- 直近の明細（最大30件 / 最新が上）--- */}
          <div className="space-y-2">
            {limitedRecords
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.id} className="text-xs flex items-baseline justify-between border-b border-white/5 pb-1">
                  <div className="opacity-70">{r.dateStr}</div>
                  <div className="tabular-nums">
                    {r.totals.loadKg.toFixed(1)} kg ・ {r.totals.reps} rep ・ {r.totals.sets} set
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}