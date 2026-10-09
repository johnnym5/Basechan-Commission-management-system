export interface IntakeDeadlineInfo {
  label: string;
  daysLeft: number | null;
  status: 'URGENT' | 'OPEN' | 'PASSED' | 'GENERAL';
}

export const getIntakeDeadlineInfo = (intakeStr?: string): IntakeDeadlineInfo => {
  if (!intakeStr) {
    return { label: 'Standard Intake', daysLeft: null, status: 'GENERAL' };
  }

  const str = intakeStr.toLowerCase();
  const now = new Date();

  // Common Academic Deadlines (Targeting 2025 / 2026 cycles)
  let targetDate: Date | null = null;
  let termName = 'Intake';

  if (str.includes('jan') || str.includes('feb')) {
    termName = 'Jan Intake';
    targetDate = new Date(2026, 0, 31); // Jan 31, 2026
  } else if (str.includes('may') || str.includes('jun')) {
    termName = 'May Intake';
    targetDate = new Date(2026, 4, 31); // May 31, 2026
  } else if (str.includes('sep') || str.includes('oct')) {
    termName = 'Sept Intake';
    targetDate = new Date(2025, 8, 30); // Sept 30, 2025
  }

  if (!targetDate) {
    return { label: `${intakeStr}`, daysLeft: null, status: 'GENERAL' };
  }

  const diffTime = targetDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `${termName} Passed`, daysLeft: 0, status: 'PASSED' };
  }

  if (diffDays <= 30) {
    return { label: `${termName}: ${diffDays}d left`, daysLeft: diffDays, status: 'URGENT' };
  }

  return { label: `${termName}: ${diffDays}d left`, daysLeft: diffDays, status: 'OPEN' };
};
