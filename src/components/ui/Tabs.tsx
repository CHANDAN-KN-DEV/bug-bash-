import React from 'react';
import { cn } from '../../lib/utils';

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <div className={cn('w-full', className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, { activeValue: value, onChange: onValueChange });
        }
        return child;
      })}
    </div>
  );
}

export function TabsList({ children, className, activeValue, onChange }: any) {
  return (
    <div className={cn('inline-flex h-11 items-center justify-start rounded-lg bg-slate-900 p-1 text-slate-400 border border-slate-800', className)}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          const el = child as React.ReactElement<any>;
          return React.cloneElement(el, {
            isActive: el.props.value === activeValue,
            onClick: () => onChange?.(el.props.value),
          });
        }
        return child;
      })}
    </div>
  );
}

export function TabsTrigger({ value, children, className, isActive, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3.5 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'hover:bg-slate-800/60 hover:text-slate-200 text-slate-400',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, activeValue, children, className }: any) {
  if (value !== activeValue) return null;
  return <div className={cn('mt-4 focus-visible:outline-none', className)}>{children}</div>;
}
