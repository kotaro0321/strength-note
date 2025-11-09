/** strength-note 用 Plan（今日の予定）管理ユーティリティ */

export type PlanItem = {
  id: string;          // 一意のID
  dateStr: string;     // 日付（YYYY-MM-DD）
  exerciseName: string;// 種目名
  part: string;        // 部位（胸/背中/肩/腕/脚/体幹）
  done: boolean;       // 実施フラグ
};

const PLANS_KEY = 'strength-note:plans:v1';

/** すべての予定を取得 */
export function getAllPlans(): PlanItem[] {
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

/** 予定を全体保存 */
export function setPlans(plans: PlanItem[]) {
  try {
    localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  } catch (e) {
    console.warn('Failed to setPlans', e);
  }
}

/** 指定日の予定を取得 */
export function getPlansByDate(dateStr: string): PlanItem[] {
  const all = getAllPlans();
  return all.filter(p => p.dateStr === dateStr);
}

/** 予定を追加（重複を許容） */
export function addPlan(dateStr: string, exerciseName: string, part: string) {
  const plans = getAllPlans();
  const newPlan: PlanItem = {
    id: `${dateStr}-${exerciseName}-${Date.now()}`,
    dateStr,
    exerciseName,
    part,
    done: false,
  };
  setPlans([newPlan, ...plans]);
  return newPlan;
}

/** 予定の完了状態を切り替え */
export function toggleDone(id: string) {
  const plans = getAllPlans().map(p =>
    p.id === id ? { ...p, done: !p.done } : p
  );
  setPlans(plans);
}

/** 予定を削除 */
export function removePlan(id: string) {
  const next = getAllPlans().filter(p => p.id !== id);
  setPlans(next);
}

/** 当日の予定をクリア（必要に応じて使用） */
export function clearPlansByDate(dateStr: string) {
  const next = getAllPlans().filter(p => p.dateStr !== dateStr);
  setPlans(next);
}