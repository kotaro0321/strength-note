/** strength-note 用 localStorage ユーティリティ */

// 単位・行の型（他からも再利用できるように export）
export type Unit = 'kg' | 'lb';
export type SetRow = { weight: string; reps: string; rpe: string };

// 換算係数（lb → kg）
const KG_PER_LB = 0.45359237;

// レコード型定義
export type RecordItem = {
  id: string;                 // 一意のID
  dateStr: string;            // 日付 YYYY-MM-DD
  exerciseName: string;       // 種目名
  unit: 'kg' | 'lb';          // 単位
  rows: { weight: string; reps: string; rpe: string }[];
  totals: { loadKg: number; reps: number; sets: number };
  createdAt: string;          // 保存時刻 ISO
};

const RECORDS_KEY = 'strength-note:records:v1';

/** すべてのレコードを取得 */
export function getRecords(): RecordItem[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

/** すべてのレコードを保存 */
export function setRecords(records: RecordItem[]) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Failed to setRecords', e);
  }
}

/** 単一レコードを追加（最新が先頭になるように） */
export function addRecord(newRecord: RecordItem) {
  const current = getRecords();
  const updated = [newRecord, ...current.filter(r => r.id !== newRecord.id)];
  setRecords(updated);
}

/** 日付でフィルタリング */
export function getRecordsByDate(dateStr: string): RecordItem[] {
  const all = getRecords();
  return all.filter(r => r.dateStr === dateStr);
}

/** rows から合計値を算出（単位に応じて kg 換算） */
export function computeTotals(rows: SetRow[], unit: Unit) {
  const toKg = (wStr: string) => {
    const w = parseFloat(wStr);
    if (!Number.isFinite(w)) return 0;
    return unit === 'kg' ? w : w * KG_PER_LB;
  };
  const valid = rows.filter(r => {
    const w = parseFloat(r.weight);
    const reps = parseInt(r.reps, 10);
    return Number.isFinite(w) && w > 0 && Number.isFinite(reps) && reps > 0;
  });
  const reps = valid.reduce((s, r) => s + (parseInt(r.reps, 10) || 0), 0);
  const loadKg = Math.round(
    valid.reduce((s, r) => s + toKg(r.weight) * (parseInt(r.reps, 10) || 0), 0) * 10
  ) / 10;
  const sets = valid.length;
  return { loadKg, reps, sets };
}

/** レコード作成ファクトリ：ID・合計・タイムスタンプを自動付与 */
export function createRecord(input: {
  dateStr: string;
  exerciseName: string;
  unit: Unit;
  rows: SetRow[];
}): RecordItem {
  const totals = computeTotals(input.rows, input.unit);
  const id = `${input.dateStr}:${input.exerciseName}:${Date.now()}`;
  const createdAt = new Date().toISOString();
  return {
    id,
    dateStr: input.dateStr,
    exerciseName: input.exerciseName,
    unit: input.unit,
    rows: input.rows,
    totals,
    createdAt,
  };
}

/**
 * 同一キー（dateStr + exerciseName + unit）で upsert。
 * 既存があれば置換、なければ追加。常に新しい方が先頭。
 */
export function upsertRecord(input: {
  dateStr: string;
  exerciseName: string;
  unit: Unit;
  rows: SetRow[];
}) {
  const key = (r: RecordItem) => `${r.dateStr}::${r.exerciseName}::${r.unit}`;
  const store = getRecords();
  const next = createRecord(input);
  const filtered = store.filter(r => key(r) !== key(next));
  setRecords([next, ...filtered]);
  return next;
}

/** 種目＋単位で最新レコードを取得（なければ null） */
export function getLatestByExercise(exerciseName: string, unit: Unit): RecordItem | null {
  const all = getRecords().filter(r => r.exerciseName === exerciseName && r.unit === unit);
  if (all.length === 0) return null;
  // createdAt が新しい順にソート
  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return all[0];
}

/** 種目（必要なら単位も）で履歴を取得。新しい順にソート */
export function getRecordsByExercise(exerciseName: string, unit?: Unit): RecordItem[] {
  const name = (exerciseName || '').trim();
  const all = getRecords();

  const filtered = all.filter(r => {
    const sameName = (r.exerciseName || '').trim() === name;
    const sameUnit = unit ? r.unit === unit : true;
    return sameName && sameUnit;
  });

  // createdAt 降順（新しい→古い）
  filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return filtered;
}

// ★ 部位選択画面（/select/[part]）から使うヘルパー
//   指定した日付に、選択された種目名を RecordItem として登録する
export function addExercisesForDate(
  dateStr: string,
  exerciseNames: string[],
  unit: Unit = 'kg', // デフォルトは kg
) {
  // 名前の重複を一応排除しておく
  const uniqueNames = Array.from(
    new Set(exerciseNames.map((name) => name.trim()).filter(Boolean)),
  );

  uniqueNames.forEach((exerciseName) => {
    upsertRecord({
      dateStr,
      exerciseName,
      unit,
      rows: [], // ここではまだセットを入れない（totals は 0,0,0 になる）
    });
  });
}

/** IDを指定してレコードを削除 */
export function deleteRecordById(id: string) {
  const all = getRecords();
  const next = all.filter(r => r.id !== id);
  setRecords(next);
}