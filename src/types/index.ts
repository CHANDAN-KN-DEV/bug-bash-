export type Role = 'admin' | 'student' | 'team';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  roll_no: string;
  email: string;
  created_at?: string;
}

export type RoundStatus = 'draft' | 'ready' | 'live' | 'stopped' | 'completed';

export interface Round {
  id: string;
  round_number: 1 | 2 | 3;
  name: string;
  description: string;
  duration_minutes: number;
  status: RoundStatus;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
}

export type CodeLanguage = 'c' | 'python' | 'javascript' | 'cpp' | 'java';

export interface Program {
  id: string;
  round_id: string;
  title: string;
  language: CodeLanguage;
  description: string;
  buggy_code: string;
  reference_solution?: string; // Only accessible by admin
  points: number;
  created_at?: string;
}

export interface Assignment {
  id: string;
  student_id: string;
  program_id: string;
  round_id: string;
  sequence?: number;
  created_at?: string;
}

export type AttemptStatus = 'not_started' | 'in_progress' | 'completed' | 'time_over' | 'terminated';

export interface RoundAttempt {
  id: string;
  student_id: string;
  round_id: string;
  started_at: string | null;
  ends_at: string | null; // ISO string calculated server-side
  completed_at: string | null;
  status: AttemptStatus;
  termination_reason?: string | null;
  warnings_count: number;
  created_at?: string;
}

export type SubmissionStatus = 'submitted' | 'incomplete' | 'evaluated';

export interface Submission {
  id: string;
  attempt_id: string;
  program_id: string;
  student_id: string;
  code: string;
  status: SubmissionStatus;
  submitted_at: string;
  score: number;
}

export interface Draft {
  id?: string;
  attempt_id: string;
  program_id: string;
  student_id: string;
  code: string;
  updated_at: string;
}

export type ViolationType = 
  | 'tab_switch' 
  | 'window_blur' 
  | 'fullscreen_exit' 
  | 'clipboard_action' 
  | 'resize_suspicious';

export interface Violation {
  id: string;
  student_id: string;
  round_id: string;
  attempt_id?: string;
  violation_type: ViolationType;
  details?: string;
  user_agent?: string;
  created_at: string;
  // joined fields
  student_name?: string;
  student_roll?: string;
  round_name?: string;
}

export interface ExamSettings {
  id: number;
  strict_mode: boolean; // Terminate on 1st violation if true, else warn
  max_warnings: number;
  block_copy_paste: boolean;
  require_fullscreen: boolean;
  grace_period_seconds: number;
  updated_at?: string;
}

export interface StudentProgress {
  student: Profile;
  attempt: RoundAttempt | null;
  assignedCount: number;
  submittedCount: number;
  score: number;
  violationsCount: number;
  timeRemainingSeconds: number;
  lastActive: string;
}
