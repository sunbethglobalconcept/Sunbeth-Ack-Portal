const UNKNOWN_DATE_LABEL = 'N/A';

export const formatDueDate = (due?: string | null) => {
  if (!due) return UNKNOWN_DATE_LABEL;
  try {
    return new Date(due).toLocaleDateString();
  } catch {
    return due;
  }
};

export const hasDueDatePassed = (due?: string | null) => {
  if (!due) return false;
  const parsed = new Date(due);
  if (Number.isNaN(parsed.getTime())) return false;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return parsed.getTime() < todayMidnight.getTime();
};
