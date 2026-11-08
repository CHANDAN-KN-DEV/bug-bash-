import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (title: string, message?: string, type?: ToastType) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((title: string, message?: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, 4500);
  }, [removeToast]);

  const success = (title: string, message?: string) => addToast(title, message, 'success');
  const error = (title: string, message?: string) => addToast(title, message, 'error');
  const warning = (title: string, message?: string) => addToast(title, message, 'warning');

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning }}>
      {children}
      <div className="drift-toast-stack fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none p-4">
        {toasts.map(t => {
          const icons = {
            success: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />,
            error: <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />,
            warning: <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />,
            info: <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />,
          };

          const borderColors = {
            success: 'border-emerald-500/30 bg-slate-900/95 text-emerald-200',
            error: 'border-rose-500/30 bg-slate-900/95 text-rose-200',
            warning: 'border-amber-500/30 bg-slate-900/95 text-amber-200',
            info: 'border-indigo-500/30 bg-slate-900/95 text-indigo-200',
          };

          return (
            <div
              key={t.id}
              data-status={t.type}
              className={cn(
                'drift-toast-card pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5',
                borderColors[t.type]
              )}
            >
              {icons[t.type]}
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.message && <p className="text-xs text-slate-300">{t.message}</p>}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
