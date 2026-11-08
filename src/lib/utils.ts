import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Assignment, Round } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shuffleAssignmentsForRound(assignments: Assignment[], roundId: string): Assignment[] {
  const roundAssignments = assignments.filter(assignment => assignment.round_id === roundId);
  const studentIds = Array.from(new Set(roundAssignments.map(assignment => assignment.student_id)));
  const shuffled = studentIds.flatMap(studentId => {
    const studentAssignments = roundAssignments.filter(assignment => assignment.student_id === studentId);
    for (let index = studentAssignments.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [studentAssignments[index], studentAssignments[swapIndex]] = [studentAssignments[swapIndex], studentAssignments[index]];
    }
    return studentAssignments.map((assignment, sequence) => ({ ...assignment, sequence }));
  });
  const shuffledById = new Map(shuffled.map(assignment => [assignment.id, assignment]));
  return assignments.map(assignment =>
    assignment.round_id === roundId
      ? shuffledById.get(assignment.id) || assignment
      : assignment
  );
}

export function ensureLiveAssignmentOrders(assignments: Assignment[], rounds: Round[]): Assignment[] {
  return rounds.reduce((orderedAssignments, round) => {
    const roundAssignments = orderedAssignments.filter(assignment => assignment.round_id === round.id);
    if (round.status !== 'live' || roundAssignments.length === 0 ||
        roundAssignments.every(assignment => Number.isInteger(assignment.sequence))) {
      return orderedAssignments;
    }
    return shuffleAssignmentsForRound(orderedAssignments, round.id);
  }, assignments);
}

export function formatSeconds(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
}

export function formatFullDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '—';
  }
}

export function calculateTimeTaken(startIso?: string | null, endIso?: string | null): string {
  if (!startIso) return '—';
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  return formatSeconds(diffSec);
}
