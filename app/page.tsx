'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToday } from '@/hooks/useToday';
import { getRecords } from '@/lib/storage';

export default function Home() {
  const router = useRouter();
  const today = useToday();                // 今日の日付 "YYYY-MM-DD"
  const [date, setDate] = useState(today); // 選択中の日付

  const [trainedDates, setTrainedDates] = useState<Set<string>>(new Set());

  // カレンダー表示用の「見ている年月」（選択中の日付の月を初期値にする）
  const [viewYear, setViewYear] = useState(() => {
    const [y] = today.split('-').map(Number);
    return y;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const [, m] = today.split('-').map(Number);
    return (m || 1) - 1; // 0-11
  });

  // 記録がある日付を localStorage から読み込む
  useEffect(() => {
    try {
      const all = getRecords();
      const s = new Set(all.map((r) => r.dateStr));
      setTrainedDates(s);
    } catch {
      setTrainedDates(new Set());
    }
  }, []);

  // YYYY-MM-DD 形式にフォーマット
  const formatYMD = (y: number, mZeroBased: number, d: number) => {
    const mm = String(mZeroBased + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // カレンダー用のセル配列を作成
  type CalendarCell = {
    key: string;
    label: string;
    dateStr?: string;
    isToday?: boolean;
    isSelected?: boolean;
    hasRecord?: boolean;
  };

  const firstDay = new Date(viewYear, viewMonth, 1);
  const firstWeekday = firstDay.getDay(); // 0:日曜〜6:土曜
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  // 1日目の曜日まで空セルを入れる
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ key: `blank-${i}`, label: '' });
  }

  // 当月の日付セルを追加
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = formatYMD(viewYear, viewMonth, d);
    cells.push({
      key: `d-${ds}`,
      label: String(d),
      dateStr: ds,
      isToday: ds === today,
      isSelected: ds === date,
      hasRecord: trainedDates.has(ds),
    });
  }

  // 行が7の倍数になるように末尾を空セルで埋める
  while (cells.length % 7 !== 0) {
    const idx = cells.length;
    cells.push({ key: `blank-tail-${idx}`, label: '' });
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const handlePrevMonth = () => {
    let y = viewYear;
    let m = viewMonth - 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    setViewYear(y);
    setViewMonth(m);
  };

  const handleNextMonth = () => {
    let y = viewYear;
    let m = viewMonth + 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
  });

  const handleGoToday = () => {
    if (!date) return;                     // 念のため空チェック
    router.push(`/today?date=${date}`);    // 選んだ日付の Today 画面へ
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#050816] via-[#020617] to-black text-white">
      {/* ヘッダー：アプリ全体のタイトル */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-black/80 via-[#020617]/95 to-transparent backdrop-blur border-b border-white/10">
        <div className="mx-auto max-w-screen-sm px-6 py-4 flex items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Strength Note</h1>
            <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-teal-300/80">
              Training Log
            </div>
          </div>
        </div>
      </header>

      {/* 本文コンテンツ */}
      <div className="mx-auto max-w-screen-sm px-6 py-10 space-y-6">
        {/* 日付選択カード（カレンダー） */}
        <section className="rounded-2xl border border-white/10 bg-[#020617]/95 p-5 shadow-sm">
          {/* カードヘッダー */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/50">
                Select Date
              </div>
              <div className="mt-1 text-sm text-white/80">
                記録したい日をカレンダーから選んでください。
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end text-[11px] text-white/60 tabular-nums">
              <span className="opacity-70">Today</span>
              <span className="font-medium text-white/90">{today}</span>
            </div>
          </div>

          {/* カレンダー本体 */}
          <div className="rounded-xl bg-black/30 border border-white/10 p-3 space-y-3">
            {/* 月切り替えヘッダー */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-xs"
                aria-label="前の月へ"
              >
                ←
              </button>
              <div className="text-sm font-medium text-white/90 tabular-nums">{monthLabel}</div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-xs"
                aria-label="次の月へ"
              >
                →
              </button>
            </div>

            {/* 曜日ラベル */}
            <div className="grid grid-cols-7 text-[11px] text-center text-white/40 gap-1">
              <div>日</div>
              <div>月</div>
              <div>火</div>
              <div>水</div>
              <div>木</div>
              <div>金</div>
              <div>土</div>
            </div>

            {/* 日付グリッド */}
            <div className="grid grid-cols-7 gap-1 text-xs sm:text-sm">
              {weeks.map((week, wi) => (
                <div key={wi} className="contents">
                  {week.map((cell) => {
                    if (!cell.dateStr) {
                      return (
                        <div
                          key={cell.key}
                          className="h-8 sm:h-9"
                        />
                      );
                    }

                    const baseClass =
                      'h-8 sm:h-9 flex items-center justify-center rounded-full tabular-nums transition text-[11px] sm:text-xs';
                    const stateClass = cell.isSelected
                      ? 'bg-teal-500 text-black font-semibold shadow'
                      : cell.isToday
                      ? 'border border-teal-400/80 text-teal-200 bg-black/60'
                      : cell.hasRecord
                      ? 'bg-teal-500/20 text-teal-100 border border-teal-500/40'
                      : 'bg-white/5 text-white/80 hover:bg-white/15';

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setDate(cell.dateStr!)}
                        className={`${baseClass} ${stateClass}`}
                      >
                        {cell.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 選択中の情報と Today へ進むボタン */}
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleGoToday}
              disabled={!date}
              className={`w-full sm:w-auto rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold tabular-nums
                ${
                  date
                    ? 'bg-teal-500 text-black hover:bg-teal-400 transition'
                    : 'bg-teal-500/30 text-white/40 cursor-not-allowed'
                }`}
            >
              {date ? 'この日の記録を開く' : '日付を選択してください'}
            </button>
          </div>
        </section>

        {/* 使い方の簡単なヒント */}
        <section className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/45 mb-1">
            How to Use
          </div>
          <ul className="text-xs text-white/65 space-y-1.5">
            <li>1. 上で日付を選択して「記録 へ進む」を押します。</li>
            <li>2. Today画面で種目カードをタップして、Log 画面でセットを入力します。</li>
            <li>3. 保存すると、その日の Today に戻り、合計ボリュームが反映されます。</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
