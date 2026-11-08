import { useEffect, useRef, useState, useCallback } from 'react';
import { useExam } from '../context/ExamContext';
import { ViolationType } from '../types';

interface UseExamSecurityProps {
  isActive: boolean;
  onTerminated?: () => void;
  onDraftSaveNeeded?: () => void;
  confirmFullscreenExit?: boolean;
}

export function useExamSecurity({ isActive, onTerminated, onDraftSaveNeeded, confirmFullscreenExit = false }: UseExamSecurityProps) {
  const { settings, recordViolation } = useExam();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(Boolean(document.fullscreenElement));
  const [warningAlert, setWarningAlert] = useState<{ visible: boolean; message: string } | null>(null);
  const [fullscreenExitPrompt, setFullscreenExitPrompt] = useState(false);

  const graceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const violationPendingRef = useRef<ViolationType | null>(null);
  const isHandlingViolationRef = useRef(false);
  const allowNextFullscreenExitRef = useRef(false);

  // Helper to enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Fullscreen request failed or was denied:', err);
    }
  }, []);

  // Helper to exit fullscreen safely
  const exitFullscreen = useCallback(async () => {
    if (confirmFullscreenExit && isActive) {
      setFullscreenExitPrompt(true);
      return;
    }
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen exit failed:', err);
    }
  }, [confirmFullscreenExit, isActive]);

  // Trigger violation with grace period
  const triggerViolation = useCallback(
    (type: ViolationType, details: string) => {
      if (!isActive || isHandlingViolationRef.current) return;

      // Flush any pending drafts immediately
      onDraftSaveNeeded?.();

      violationPendingRef.current = type;

      // Grace period delay (e.g. 1.5 - 2 seconds) to avoid immediate false-positives
      const graceMs = (settings.grace_period_seconds || 2) * 1000;

      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
      }

      graceTimerRef.current = setTimeout(async () => {
        isHandlingViolationRef.current = true;
        try {
          const isTerminated = await recordViolation(type, details);
          if (isTerminated) {
            onTerminated?.();
          } else {
            // Show temporary warning badge
            setWarningAlert({
              visible: true,
              message: `Warning: ${details}. Repeated violations will terminate your exam.`,
            });
            setTimeout(() => setWarningAlert(null), 5000);
          }
        } finally {
          isHandlingViolationRef.current = false;
          violationPendingRef.current = null;
        }
      }, graceMs);
    },
    [isActive, settings.grace_period_seconds, recordViolation, onTerminated, onDraftSaveNeeded]
  );

  const respondToFullscreenExit = useCallback(async (shouldExit: boolean) => {
    if (!shouldExit) {
      await enterFullscreen();
      if (document.fullscreenElement) setFullscreenExitPrompt(false);
      return;
    }

    setFullscreenExitPrompt(false);
    if (document.fullscreenElement) {
      allowNextFullscreenExitRef.current = true;
      try {
        await document.exitFullscreen();
      } catch (err) {
        allowNextFullscreenExitRef.current = false;
        console.warn('Fullscreen exit failed:', err);
        return;
      }
    }
    triggerViolation('fullscreen_exit', 'Exited mandatory fullscreen mode');
  }, [enterFullscreen, triggerViolation]);

  // Clear grace timer if user quickly returns to normal state
  const clearPendingViolation = useCallback(() => {
    if (graceTimerRef.current) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
      violationPendingRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;

    // 1. Visibility change (Tab switch / Minimize)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('tab_switch', 'Tab switched or browser minimized');
      } else {
        clearPendingViolation();
      }
    };

    // 2. Window Blur (loss of focus)
    const handleBlur = () => {
      triggerViolation('window_blur', 'Window lost focus (switched application or clicked outside)');
    };

    const handleFocus = () => {
      clearPendingViolation();
    };

    // 3. Fullscreen change
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active && confirmFullscreenExit && isActive) {
        if (allowNextFullscreenExitRef.current) {
          allowNextFullscreenExitRef.current = false;
        } else {
          setFullscreenExitPrompt(true);
        }
      } else if (!active && settings.require_fullscreen) {
        triggerViolation('fullscreen_exit', 'Exited mandatory fullscreen mode');
      } else if (active) {
        setFullscreenExitPrompt(false);
        clearPendingViolation();
      }
    };

    // 4. Clipboard / Context Menu blocking
    const handleCopy = (e: ClipboardEvent) => {
      if (settings.block_copy_paste) {
        e.preventDefault();
        triggerViolation('clipboard_action', 'Copy action attempted in exam arena');
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (settings.block_copy_paste) {
        e.preventDefault();
        triggerViolation('clipboard_action', 'Paste action attempted in exam arena');
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (settings.block_copy_paste) {
        e.preventDefault();
        triggerViolation('clipboard_action', 'Cut action attempted in exam arena');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (settings.block_copy_paste) {
        e.preventDefault();
      }
    };

    // Keyboard shortcut interception (e.g. F11, Alt+Tab, Ctrl+C/V when block enabled)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settings.block_copy_paste) {
        if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'p'].includes(e.key.toLowerCase())) {
          // Allow Ctrl+A (select all within current file) if wanted, but block C, V, X
          if (['c', 'v', 'x'].includes(e.key.toLowerCase())) {
            e.preventDefault();
          }
        }
      }
      // Block Escape key from exiting fullscreen if we can
      if (e.key === 'Escape' && settings.require_fullscreen) {
        // Browsers handle escape natively for fullscreen exit, so fullscreenchange will catch it
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('cut', handleCut);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('cut', handleCut);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);

      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
      }
    };
  }, [isActive, settings, triggerViolation, clearPendingViolation, confirmFullscreenExit]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    fullscreenExitPrompt,
    respondToFullscreenExit,
    warningAlert,
  };
}
