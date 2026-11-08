import {
  Profile,
  Round,
  Program,
  ExamSettings,
  Assignment,
  RoundAttempt,
  Submission,
  Draft,
  Violation,
} from '../types';
import {
  INITIAL_ADMIN,
  INITIAL_STUDENTS,
  INITIAL_ROUNDS,
  INITIAL_SETTINGS,
  INITIAL_PROGRAMS,
  INITIAL_ASSIGNMENTS,
  INITIAL_ATTEMPTS,
  INITIAL_SUBMISSIONS,
  INITIAL_VIOLATIONS,
} from './demoData';

const STORAGE_KEYS = {
  ADMIN: 'bba_admin',
  STUDENTS: 'bba_students',
  ROUNDS: 'bba_rounds',
  SETTINGS: 'bba_settings',
  PROGRAMS: 'bba_programs',
  ASSIGNMENTS: 'bba_assignments',
  ATTEMPTS: 'bba_attempts',
  SUBMISSIONS: 'bba_submissions',
  DRAFTS: 'bba_drafts',
  VIOLATIONS: 'bba_violations',
  CURRENT_USER: 'bba_current_user',
};

function getStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage set failed for key', key, e);
  }
}

export const LocalStore = {
  getAdmin: (): Profile => getStored(STORAGE_KEYS.ADMIN, INITIAL_ADMIN),
  getStudents: (): Profile[] => getStored(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS),
  setStudents: (val: Profile[]) => setStored(STORAGE_KEYS.STUDENTS, val),

  getRounds: (): Round[] => getStored(STORAGE_KEYS.ROUNDS, INITIAL_ROUNDS),
  setRounds: (val: Round[]) => setStored(STORAGE_KEYS.ROUNDS, val),

  getSettings: (): ExamSettings => getStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS),
  setSettings: (val: ExamSettings) => setStored(STORAGE_KEYS.SETTINGS, val),

  getPrograms: (): Program[] => getStored(STORAGE_KEYS.PROGRAMS, INITIAL_PROGRAMS),
  setPrograms: (val: Program[]) => setStored(STORAGE_KEYS.PROGRAMS, val),

  getAssignments: (): Assignment[] => getStored(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS),
  setAssignments: (val: Assignment[]) => setStored(STORAGE_KEYS.ASSIGNMENTS, val),

  getAttempts: (): RoundAttempt[] => getStored(STORAGE_KEYS.ATTEMPTS, INITIAL_ATTEMPTS),
  setAttempts: (val: RoundAttempt[]) => setStored(STORAGE_KEYS.ATTEMPTS, val),

  getSubmissions: (): Submission[] => getStored(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS),
  setSubmissions: (val: Submission[]) => setStored(STORAGE_KEYS.SUBMISSIONS, val),

  getDrafts: (): Draft[] => getStored(STORAGE_KEYS.DRAFTS, []),
  setDrafts: (val: Draft[]) => setStored(STORAGE_KEYS.DRAFTS, val),

  getViolations: (): Violation[] => getStored(STORAGE_KEYS.VIOLATIONS, INITIAL_VIOLATIONS),
  setViolations: (val: Violation[]) => setStored(STORAGE_KEYS.VIOLATIONS, val),

  getCurrentUser: (): Profile | null => getStored(STORAGE_KEYS.CURRENT_USER, INITIAL_ADMIN),
  setCurrentUser: (val: Profile | null) => setStored(STORAGE_KEYS.CURRENT_USER, val),

  resetToDefault: () => {
    localStorage.clear();
    setStored(STORAGE_KEYS.ADMIN, INITIAL_ADMIN);
    setStored(STORAGE_KEYS.STUDENTS, INITIAL_STUDENTS);
    setStored(STORAGE_KEYS.ROUNDS, INITIAL_ROUNDS);
    setStored(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    setStored(STORAGE_KEYS.PROGRAMS, INITIAL_PROGRAMS);
    setStored(STORAGE_KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS);
    setStored(STORAGE_KEYS.ATTEMPTS, INITIAL_ATTEMPTS);
    setStored(STORAGE_KEYS.SUBMISSIONS, INITIAL_SUBMISSIONS);
    setStored(STORAGE_KEYS.DRAFTS, []);
    setStored(STORAGE_KEYS.VIOLATIONS, INITIAL_VIOLATIONS);
    setStored(STORAGE_KEYS.CURRENT_USER, INITIAL_ADMIN);
  },
};

