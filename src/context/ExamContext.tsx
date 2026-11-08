import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Round,
  Program,
  Assignment,
  RoundAttempt,
  Submission,
  Draft,
  Violation,
  ExamSettings,
  Profile,
  StudentProgress,
  ViolationType,
  RoundStatus,
} from '../types';
import { LocalStore } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiGet, apiPatch, apiPost, apiPut } from '../lib/api';
import { useAuth } from './AuthContext';
import { ensureLiveAssignmentOrders, shuffleAssignmentsForRound } from '../lib/utils';

export interface StudentCredential {
  student: Profile;
  initial_password: string;
}

interface ExamContextType {
  rounds: Round[];
  programs: Program[];
  assignments: Assignment[];
  attempts: RoundAttempt[];
  submissions: Submission[];
  drafts: Draft[];
  violations: Violation[];
  settings: ExamSettings;
  students: Profile[];
  liveRound: Round | undefined;

  // Student Actions
  startRoundAttempt: (roundId: string) => Promise<{ success: boolean; attempt?: RoundAttempt; error?: string }>;
  saveDraft: (attemptId: string, programId: string, code: string) => Promise<void>;
  submitProgram: (attemptId: string, programId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  finishRound: (attemptId: string) => Promise<{ success: boolean; error?: string }>;
  recordViolation: (violationType: ViolationType, details?: string) => Promise<boolean>; // returns if terminated

  // Admin Actions
  updateRoundStatus: (roundId: string, status: RoundStatus) => Promise<void>;
  updateRoundDuration: (roundId: string, minutes: number) => Promise<void>;
  updateSettings: (newSettings: Partial<ExamSettings>) => Promise<void>;
  createProgram: (program: Omit<Program, 'id'>) => Promise<void>;
  updateProgram: (program: Program) => Promise<void>;
  deleteProgram: (programId: string) => Promise<void>;
  addStudent: (student: Omit<Profile, 'id'>) => Promise<StudentCredential>;
  updateStudent: (student: Profile) => Promise<void>;
  importStudentsCsv: (studentsList: Array<{ roll_no: string; full_name: string; email: string }>) => Promise<StudentCredential[]>;
  assignProgramsToStudents: (newAssignments: Assignment[]) => Promise<void>;
  bulkRandomAssign: (roundId: string, countPerStudent: number) => Promise<void>;
  reallowStudent: (attemptId: string, additionalMinutes?: number) => Promise<void>;
  resetAllDemoData: () => void;

  // Computed
  getStudentProgressList: (roundId?: string) => StudentProgress[];
  getAttemptForStudent: (studentId: string, roundId: string) => RoundAttempt | undefined;
  getAssignedProgramsForStudent: (studentId: string, roundId: string) => Program[];
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

export const ExamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<Round[]>(() => LocalStore.getRounds());
  const [programs, setPrograms] = useState<Program[]>(() => LocalStore.getPrograms());
  const [assignments, setAssignments] = useState<Assignment[]>(() => LocalStore.getAssignments());
  const [attempts, setAttempts] = useState<RoundAttempt[]>(() => LocalStore.getAttempts());
  const [submissions, setSubmissions] = useState<Submission[]>(() => LocalStore.getSubmissions());
  const [drafts, setDrafts] = useState<Draft[]>(() => LocalStore.getDrafts());
  const [violations, setViolations] = useState<Violation[]>(() => LocalStore.getViolations());
  const [settings, setSettings] = useState<ExamSettings>(() => LocalStore.getSettings());
  const [students, setStudents] = useState<Profile[]>(() => LocalStore.getStudents());
  const [mongoStateReady, setMongoStateReady] = useState(false);

  const liveRound = rounds.find(r => r.status === 'live');

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const token = localStorage.getItem('bba_auth_token');
    if (!token) return;

    let active = true;
    void apiGet<{ students: Profile[] }>('/admin/students', token)
      .then(({ students: registeredStudents }) => {
        if (!active) return;
        setStudents(registeredStudents);
        LocalStore.setStudents(registeredStudents);
      })
      .catch(error => {
        console.error('Unable to load registered students from MongoDB:', error);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    setMongoStateReady(false);
    if (user?.role !== 'admin') return;
    const token = localStorage.getItem('bba_auth_token');
    if (!token) return;

    let active = true;
    const currentState = {
      rounds,
      settings,
      programs,
      assignments,
      attempts,
      submissions,
      drafts,
      violations,
    };
    void apiGet<{ initialized: boolean; state?: typeof currentState }>('/admin/arena-state', token)
      .then(async result => {
        if (!active) return;
        if (!result.initialized) {
          const initialState = {
            ...currentState,
            assignments: ensureLiveAssignmentOrders(currentState.assignments, currentState.rounds),
          };
          setAssignments(initialState.assignments);
          await apiPost('/admin/arena-state/initialize', { state: initialState }, token);
          return;
        }
        if (!result.state) throw new Error('MongoDB returned an invalid arena state.');
        const orderedAssignments = ensureLiveAssignmentOrders(result.state.assignments, result.state.rounds);
        const loadedState = { ...result.state, assignments: orderedAssignments };
        setRounds(result.state.rounds);
        setSettings(result.state.settings);
        setPrograms(result.state.programs);
        setAssignments(orderedAssignments);
        setAttempts(result.state.attempts);
        setSubmissions(result.state.submissions);
        setDrafts(result.state.drafts);
        setViolations(result.state.violations);
        if (orderedAssignments !== result.state.assignments) {
          await apiPut('/admin/arena-state', { state: loadedState }, token);
        }
      })
      .then(() => {
        if (active) setMongoStateReady(true);
      })
      .catch(error => {
        if (active) console.error('Unable to load arena administration data from MongoDB:', error);
      });

    return () => { active = false; };
  }, [user]);

  // Load from Supabase if configured
  const fetchSupabaseData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    try {
      const [
        { data: rData },
        { data: sData },
        { data: pData },
        { data: aData },
        { data: attData },
        { data: subData },
        { data: vData },
        { data: profData },
      ] = await Promise.all([
        supabase.from('rounds').select('*').order('round_number'),
        supabase.from('exam_settings').select('*').single(),
        supabase.from('programs').select('*'),
        supabase.from('assignments').select('*'),
        supabase.from('round_attempts').select('*'),
        supabase.from('submissions').select('*'),
        supabase.from('violations').select('*, profiles(full_name, roll_no), rounds(name)').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'student'),
      ]);

      if (rData) setRounds(rData as Round[]);
      if (sData) setSettings(sData as ExamSettings);
      if (pData) setPrograms(pData as Program[]);
      if (aData) setAssignments(aData as Assignment[]);
      if (attData) setAttempts(attData as RoundAttempt[]);
      if (subData) setSubmissions(subData as Submission[]);
      if (profData) setStudents(profData as Profile[]);
      if (vData) {
        setViolations(
          vData.map((v: any) => ({
            ...v,
            student_name: v.profiles?.full_name,
            student_roll: v.profiles?.roll_no,
            round_name: v.rounds?.name,
          }))
        );
      }
    } catch (err) {
      console.warn('Supabase fetch failed, using stored local data:', err);
    }
  }, []);

  useEffect(() => {
    fetchSupabaseData();

    if (isSupabaseConfigured) {
      // Setup Realtime channels
      const channel = supabase
        .channel('arena-realtime-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, () => fetchSupabaseData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'round_attempts' }, () => fetchSupabaseData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, () => fetchSupabaseData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'violations' }, () => fetchSupabaseData())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [fetchSupabaseData]);

  // Sync to local store whenever state updates
  useEffect(() => {
    LocalStore.setRounds(rounds);
    LocalStore.setPrograms(programs);
    LocalStore.setAssignments(assignments);
    LocalStore.setAttempts(attempts);
    LocalStore.setSubmissions(submissions);
    LocalStore.setDrafts(drafts);
    LocalStore.setViolations(violations);
    LocalStore.setSettings(settings);
    LocalStore.setStudents(students);
  }, [rounds, programs, assignments, attempts, submissions, drafts, violations, settings, students]);

  useEffect(() => {
    if (!mongoStateReady || user?.role !== 'admin') return;
    const token = localStorage.getItem('bba_auth_token');
    if (!token) return;

    const timeout = window.setTimeout(() => {
      void apiPut('/admin/arena-state', {
        state: { rounds, settings, programs, assignments, attempts, submissions, drafts, violations },
      }, token).catch(error => {
        console.error('Unable to save arena administration data to MongoDB:', error);
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [mongoStateReady, user, rounds, settings, programs, assignments, attempts, submissions, drafts, violations]);

  // ----------------------------------------------------
  // STUDENT ACTIONS
  // ----------------------------------------------------

  const startRoundAttempt = async (roundId: string): Promise<{ success: boolean; attempt?: RoundAttempt; error?: string }> => {
    if (!user) return { success: false, error: 'User not logged in' };

    const round = rounds.find(r => r.id === roundId);
    if (!round) return { success: false, error: 'Round not found' };
    if (round.status !== 'live' && user.role !== 'admin') {
      return { success: false, error: 'This round is not currently live.' };
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('start_round_attempt', { p_round_id: roundId });
      if (error) return { success: false, error: error.message };
      const att = data as RoundAttempt;
      setAttempts(prev => {
        const filtered = prev.filter(a => a.id !== att.id);
        return [...filtered, att];
      });
      return { success: true, attempt: att };
    }

    // Local / Demo Mode logic
    const existing = attempts.find(a => a.student_id === user.id && a.round_id === roundId);
    if (existing) {
      if (existing.status === 'in_progress') {
        return { success: true, attempt: existing };
      }
      if (['completed', 'terminated', 'time_over'].includes(existing.status)) {
        return { success: false, error: `Attempt already ${existing.status}` };
      }
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + round.duration_minutes * 60 * 1000);

    const newAttempt: RoundAttempt = {
      id: existing ? existing.id : `att-${user.id.slice(-4)}-${roundId.slice(-4)}-${Date.now()}`,
      student_id: user.id,
      round_id: roundId,
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      completed_at: null,
      status: 'in_progress',
      warnings_count: 0,
    };

    setAttempts(prev => [...prev.filter(a => a.id !== newAttempt.id), newAttempt]);
    return { success: true, attempt: newAttempt };
  };

  const saveDraft = async (attemptId: string, programId: string, code: string): Promise<void> => {
    if (!user) return;

    if (isSupabaseConfigured) {
      await supabase.rpc('save_draft', {
        p_attempt_id: attemptId,
        p_program_id: programId,
        p_code: code,
      });
    }

    const newDraft: Draft = {
      attempt_id: attemptId,
      program_id: programId,
      student_id: user.id,
      code,
      updated_at: new Date().toISOString(),
    };

    setDrafts(prev => {
      const next = prev.filter(d => !(d.attempt_id === attemptId && d.program_id === programId));
      return [...next, newDraft];
    });
  };

  const submitProgram = async (attemptId: string, programId: string, code: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'User not logged in' };

    const attempt = attempts.find(a => a.id === attemptId);
    if (!attempt || attempt.status !== 'in_progress') {
      return { success: false, error: 'Round is no longer active.' };
    }

    // Check expiry
    if (attempt.ends_at && new Date() > new Date(attempt.ends_at)) {
      setAttempts(prev => prev.map(a => (a.id === attemptId ? { ...a, status: 'time_over' } : a)));
      return { success: false, error: 'Time limit has expired. Submission locked.' };
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('submit_program', {
        p_attempt_id: attemptId,
        p_program_id: programId,
        p_code: code,
      });
      if (error) return { success: false, error: error.message };
      const sub = data as Submission;
      setSubmissions(prev => [...prev.filter(s => s.id !== sub.id), sub]);
      return { success: true };
    }

    const prog = programs.find(p => p.id === programId);
    const score = prog?.points || 10;

    const newSub: Submission = {
      id: `sub-${user.id.slice(-4)}-${programId.slice(-4)}-${Date.now()}`,
      attempt_id: attemptId,
      program_id: programId,
      student_id: user.id,
      code,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      score,
    };

    setSubmissions(prev => {
      const next = prev.filter(s => !(s.attempt_id === attemptId && s.program_id === programId));
      return [...next, newSub];
    });

    return { success: true };
  };

  const finishRound = async (attemptId: string): Promise<{ success: boolean; error?: string }> => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('finish_round', { p_attempt_id: attemptId });
      if (error) return { success: false, error: error.message };
    }

    const nowIso = new Date().toISOString();
    setAttempts(prev =>
      prev.map(a => (a.id === attemptId ? { ...a, status: 'completed', completed_at: nowIso } : a))
    );
    return { success: true };
  };

  const recordViolation = async (violationType: ViolationType, details?: string): Promise<boolean> => {
    if (!user) return false;

    const currentAttempt = attempts.find(
      a => a.student_id === user.id && a.status === 'in_progress'
    );
    if (!currentAttempt) return false;

    const userAgent = navigator.userAgent;

    if (isSupabaseConfigured) {
      const { data } = await supabase.rpc('record_violation', {
        p_attempt_id: currentAttempt.id,
        p_round_id: currentAttempt.round_id,
        p_violation_type: violationType,
        p_details: details || '',
        p_user_agent: userAgent,
      });

      if (data?.terminated) {
        setAttempts(prev =>
          prev.map(a =>
            a.id === currentAttempt.id
              ? {
                  ...a,
                  status: 'terminated',
                  warnings_count: data.warnings_count,
                  termination_reason: `Terminated due to security policy violation (${violationType})`,
                }
              : a
          )
        );
        return true;
      }
      return false;
    }

    // Local / Demo Mode logic
    const currentRound = rounds.find(r => r.id === currentAttempt.round_id);
    const newViolation: Violation = {
      id: `viol-${Date.now()}`,
      student_id: user.id,
      round_id: currentAttempt.round_id,
      attempt_id: currentAttempt.id,
      violation_type: violationType,
      details: details || 'Anti-cheating exam violation logged',
      user_agent: userAgent,
      created_at: new Date().toISOString(),
      student_name: user.full_name,
      student_roll: user.roll_no,
      round_name: currentRound?.name || 'Active Round',
    };

    setViolations(prev => [newViolation, ...prev]);

    const newWarnings = currentAttempt.warnings_count + 1;
    const shouldTerminate = settings.strict_mode || newWarnings >= settings.max_warnings;

    setAttempts(prev =>
      prev.map(a => {
        if (a.id === currentAttempt.id) {
          return {
            ...a,
            warnings_count: newWarnings,
            status: shouldTerminate ? 'terminated' : a.status,
            termination_reason: shouldTerminate
              ? `Terminated due to security policy violation (${violationType})`
              : null,
          };
        }
        return a;
      })
    );

    return shouldTerminate;
  };

  // ----------------------------------------------------
  // ADMIN ACTIONS
  // ----------------------------------------------------

  const updateRoundStatus = async (roundId: string, status: RoundStatus): Promise<void> => {
    const nowIso = new Date().toISOString();
    if (isSupabaseConfigured) {
      await supabase
        .from('rounds')
        .update({
          status,
          started_at: status === 'live' ? nowIso : undefined,
          ended_at: status === 'completed' || status === 'stopped' ? nowIso : undefined,
        })
        .eq('id', roundId);
    }

    if (status === 'live' && rounds.find(round => round.id === roundId)?.status !== 'live') {
      setAssignments(shuffleAssignmentsForRound(assignments, roundId));
    }

    setRounds(prev =>
      prev.map(r => {
        if (r.id === roundId) {
          return {
            ...r,
            status,
            started_at: status === 'live' ? nowIso : r.started_at,
            ended_at: status === 'completed' || status === 'stopped' ? nowIso : r.ended_at,
          };
        }
        // If setting a round to live, set other live rounds to stopped/completed
        if (status === 'live' && r.status === 'live' && r.id !== roundId) {
          return { ...r, status: 'stopped' };
        }
        return r;
      })
    );
  };

  const updateRoundDuration = async (roundId: string, minutes: number): Promise<void> => {
    if (isSupabaseConfigured) {
      await supabase.from('rounds').update({ duration_minutes: minutes }).eq('id', roundId);
    }
    setRounds(prev => prev.map(r => (r.id === roundId ? { ...r, duration_minutes: minutes } : r)));
  };

  const updateSettings = async (newSettings: Partial<ExamSettings>): Promise<void> => {
    const updated = { ...settings, ...newSettings };
    if (isSupabaseConfigured) {
      await supabase.from('exam_settings').update(updated).eq('id', 1);
    }
    setSettings(updated);
  };

  const createProgram = async (programData: Omit<Program, 'id'>): Promise<void> => {
    const newProg: Program = {
      ...programData,
      id: `prog-${Date.now()}`,
    };

    if (isSupabaseConfigured) {
      await supabase.from('programs').insert({
        round_id: newProg.round_id,
        title: newProg.title,
        language: newProg.language,
        description: newProg.description,
        buggy_code: newProg.buggy_code,
        points: newProg.points,
      });
      if (newProg.reference_solution) {
        await supabase.from('program_solutions').insert({
          program_id: newProg.id,
          reference_solution: newProg.reference_solution,
        });
      }
    }

    setPrograms(prev => [...prev, newProg]);

    // Also auto-assign new program to all students assigned to this round
    const studentIdsInRound = Array.from(
      new Set(assignments.filter(a => a.round_id === newProg.round_id).map(a => a.student_id))
    );
    const newAssignments: Assignment[] = studentIdsInRound.map(sid => ({
      id: `assign-${sid.slice(-4)}-${newProg.id.slice(-4)}-${Date.now()}`,
      student_id: sid,
      program_id: newProg.id,
      round_id: newProg.round_id,
      ...(rounds.find(round => round.id === newProg.round_id)?.status === 'live'
        ? {
            sequence: assignments.filter(
              assignment => assignment.student_id === sid && assignment.round_id === newProg.round_id,
            ).length,
          }
        : {}),
    }));
    setAssignments(prev => [...prev, ...newAssignments]);
  };

  const updateProgram = async (program: Program): Promise<void> => {
    if (isSupabaseConfigured) {
      await supabase
        .from('programs')
        .update({
          title: program.title,
          language: program.language,
          description: program.description,
          buggy_code: program.buggy_code,
          points: program.points,
        })
        .eq('id', program.id);

      if (program.reference_solution) {
        await supabase
          .from('program_solutions')
          .upsert({
            program_id: program.id,
            reference_solution: program.reference_solution,
          });
      }
    }

    setPrograms(prev => prev.map(p => (p.id === program.id ? program : p)));
  };

  const deleteProgram = async (programId: string): Promise<void> => {
    if (isSupabaseConfigured) {
      await supabase.from('programs').delete().eq('id', programId);
    }
    setPrograms(prev => prev.filter(p => p.id !== programId));
    setAssignments(prev => prev.filter(a => a.program_id !== programId));
  };

  const addStudent = async (studentData: Omit<Profile, 'id'>): Promise<StudentCredential> => {
    const token = localStorage.getItem('bba_auth_token');
    if (!token) throw new Error('Sign in with a MongoDB admin account to enroll students.');
    const { student: newStudent, initial_password } = await apiPost<StudentCredential>(
      '/admin/students',
      studentData,
      token,
    );
    setStudents(prev => [...prev, newStudent]);
    LocalStore.setStudents([...students, newStudent]);

    // Auto-assign existing Round 1 programs to newly added student
    const r1Programs = programs.filter(p => p.round_id === rounds[0]?.id);
    const newAssigns: Assignment[] = r1Programs.map(p => ({
      id: `assign-${newStudent.id.slice(-4)}-${p.id.slice(-4)}-${Date.now()}`,
      student_id: newStudent.id,
      program_id: p.id,
      round_id: p.round_id,
    }));
    const roundOneIsLive = rounds[0]?.status === 'live';
    setAssignments(prev => {
      const next = [...prev, ...newAssigns];
      return roundOneIsLive && rounds[0] ? shuffleAssignmentsForRound(next, rounds[0].id) : next;
    });
    return { student: newStudent, initial_password };
  };

  const updateStudent = async (student: Profile): Promise<void> => {
    const token = localStorage.getItem('bba_auth_token');
    if (!token) throw new Error('Sign in with a MongoDB admin account to update students.');
    const { student: updatedStudent } = await apiPatch<{ student: Profile }>(
      `/admin/students/${encodeURIComponent(student.id)}`,
      {
        full_name: student.full_name,
        roll_no: student.roll_no,
        email: student.email,
      },
      token,
    );
    setStudents(prev => prev.map(item => item.id === updatedStudent.id ? updatedStudent : item));
    LocalStore.setStudents(students.map(item => item.id === updatedStudent.id ? updatedStudent : item));
  };

  const importStudentsCsv = async (
    studentsList: Array<{ roll_no: string; full_name: string; email: string }>,
  ): Promise<StudentCredential[]> => {
    const token = localStorage.getItem('bba_auth_token');
    if (!token) throw new Error('Sign in with a MongoDB admin account to import students.');
    const { students: created } = await apiPost<{ students: StudentCredential[] }>(
      '/admin/students/import',
      { students: studentsList },
      token,
    );
    const newProfiles = created.map(item => item.student);

    setStudents(prev => [...prev, ...newProfiles]);
    LocalStore.setStudents([...students, ...newProfiles]);

    // Auto assign round 1 programs
    const r1Programs = programs.filter(p => p.round_id === rounds[0]?.id);
    const newAssigns: Assignment[] = [];
    newProfiles.forEach(st => {
      r1Programs.forEach(p => {
        newAssigns.push({
          id: `assign-${st.id.slice(-4)}-${p.id.slice(-4)}-${Date.now()}`,
          student_id: st.id,
          program_id: p.id,
          round_id: p.round_id,
        });
      });
    });
    const roundOneIsLive = rounds[0]?.status === 'live';
    setAssignments(prev => {
      const next = [...prev, ...newAssigns];
      return roundOneIsLive && rounds[0] ? shuffleAssignmentsForRound(next, rounds[0].id) : next;
    });

    return created;
  };

  const assignProgramsToStudents = async (newAssignments: Assignment[]): Promise<void> => {
    if (isSupabaseConfigured) {
      await supabase.from('assignments').upsert(newAssignments);
    }
    setAssignments(newAssignments);
  };

  const bulkRandomAssign = async (roundId: string, countPerStudent: number): Promise<void> => {
    const roundPrograms = programs.filter(p => p.round_id === roundId);
    if (roundPrograms.length === 0) return;

    const updatedAssignments = assignments.filter(a => a.round_id !== roundId);

    students.forEach(st => {
      // Shuffle programs for this student
      const shuffled = [...roundPrograms].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(countPerStudent, roundPrograms.length));

      selected.forEach(prog => {
        updatedAssignments.push({
          id: `assign-${st.id.slice(-4)}-${prog.id.slice(-4)}-${Date.now()}`,
          student_id: st.id,
          program_id: prog.id,
          round_id: roundId,
        });
      });
    });

    if (isSupabaseConfigured) {
      await supabase.from('assignments').delete().eq('round_id', roundId);
      await supabase.from('assignments').insert(updatedAssignments.filter(a => a.round_id === roundId));
    }

    setAssignments(
      rounds.find(round => round.id === roundId)?.status === 'live'
        ? shuffleAssignmentsForRound(updatedAssignments, roundId)
        : updatedAssignments,
    );
  };

  const reallowStudent = async (attemptId: string, additionalMinutes: number = 10): Promise<void> => {
    if (isSupabaseConfigured) {
      await supabase.rpc('reallow_student', {
        p_attempt_id: attemptId,
        p_additional_minutes: additionalMinutes,
      });
    }

    const newEndsAt = new Date(Date.now() + additionalMinutes * 60 * 1000).toISOString();
    setAttempts(prev =>
      prev.map(a =>
        a.id === attemptId
          ? {
              ...a,
              status: 'in_progress',
              termination_reason: null,
              warnings_count: 0,
              ends_at: newEndsAt,
            }
          : a
      )
    );
  };

  const resetAllDemoData = () => {
    LocalStore.resetToDefault();
    setRounds(LocalStore.getRounds());
    setPrograms(LocalStore.getPrograms());
    setAssignments(LocalStore.getAssignments());
    setAttempts(LocalStore.getAttempts());
    setSubmissions(LocalStore.getSubmissions());
    setDrafts(LocalStore.getDrafts());
    setViolations(LocalStore.getViolations());
    setSettings(LocalStore.getSettings());
    setStudents(LocalStore.getStudents());
  };

  // ----------------------------------------------------
  // COMPUTED / SELECTOR HELPERS
  // ----------------------------------------------------

  const getAttemptForStudent = useCallback(
    (studentId: string, roundId: string): RoundAttempt | undefined => {
      return attempts.find(a => a.student_id === studentId && a.round_id === roundId);
    },
    [attempts]
  );

  const getAssignedProgramsForStudent = useCallback(
    (studentId: string, roundId: string): Program[] => {
      const studentAssignments = assignments
        .filter(a => a.student_id === studentId && a.round_id === roundId)
        .sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER));
      const programById = new Map(programs.map(program => [program.id, program]));
      return studentAssignments
        .map(assignment => programById.get(assignment.program_id))
        .filter((program): program is Program => Boolean(program));
    },
    [assignments, programs]
  );

  const getStudentProgressList = useCallback(
    (roundId?: string): StudentProgress[] => {
      const targetRoundId = roundId || liveRound?.id || rounds[0]?.id;
      if (!targetRoundId) return [];

      return students.map(student => {
        const attempt = attempts.find(a => a.student_id === student.id && a.round_id === targetRoundId) || null;
        const assignedProgs = assignments.filter(a => a.student_id === student.id && a.round_id === targetRoundId);
        const studentSubs = submissions.filter(
          s => s.student_id === student.id && (attempt ? s.attempt_id === attempt.id : true)
        );
        const studentViols = violations.filter(
          v => v.student_id === student.id && v.round_id === targetRoundId
        );

        let remainingSec = 0;
        if (attempt && attempt.status === 'in_progress' && attempt.ends_at) {
          const diff = Math.floor((new Date(attempt.ends_at).getTime() - Date.now()) / 1000);
          remainingSec = Math.max(0, diff);
        }

        const score = studentSubs.reduce((acc, curr) => acc + (curr.score || 10), 0);
        const lastActive = studentSubs[studentSubs.length - 1]?.submitted_at || attempt?.started_at || 'Never';

        return {
          student,
          attempt,
          assignedCount: assignedProgs.length,
          submittedCount: studentSubs.length,
          score,
          violationsCount: studentViols.length,
          timeRemainingSeconds: remainingSec,
          lastActive,
        };
      });
    },
    [students, attempts, assignments, submissions, violations, liveRound, rounds]
  );

  return (
    <ExamContext.Provider
      value={{
        rounds,
        programs,
        assignments,
        attempts,
        submissions,
        drafts,
        violations,
        settings,
        students,
        liveRound,
        startRoundAttempt,
        saveDraft,
        submitProgram,
        finishRound,
        recordViolation,
        updateRoundStatus,
        updateRoundDuration,
        updateSettings,
        createProgram,
        updateProgram,
        deleteProgram,
        addStudent,
        updateStudent,
        importStudentsCsv,
        assignProgramsToStudents,
        bulkRandomAssign,
        reallowStudent,
        resetAllDemoData,
        getStudentProgressList,
        getAttemptForStudent,
        getAssignedProgramsForStudent,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) throw new Error('useExam must be used within ExamProvider');
  return context;
};
