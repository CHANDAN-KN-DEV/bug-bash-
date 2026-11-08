import type { OnMount } from '@monaco-editor/react';

export const registerDriftlabMonacoTheme = (monaco: Parameters<OnMount>[1]) => {
  monaco.editor.defineTheme('driftlab-ink', {
    base: 'vs-dark',
    inherit: false,
    rules: [
      { token: '', foreground: 'F3F0FF', background: '0B0B10' },
      { token: 'comment', foreground: '938FA0', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'EBA5C5' },
      { token: 'string', foreground: 'B8D7B5' },
      { token: 'number', foreground: 'D6B6F0' },
      { token: 'type', foreground: 'F0D19A' },
      { token: 'identifier', foreground: 'F3F0FF' },
    ],
    colors: {
      'editor.background': '#0B0B10',
      'editor.foreground': '#F3F0FF',
      'editorLineNumber.foreground': '#777383',
      'editorLineNumber.activeForeground': '#F3F0FF',
      'editorCursor.foreground': '#E7A8C7',
      'editor.selectionBackground': '#6E536A',
      'editor.inactiveSelectionBackground': '#39303B',
      'editor.lineHighlightBackground': '#17151E',
      'editorIndentGuide.background1': '#292631',
      'editorIndentGuide.activeBackground1': '#62536A',
      'editorWidget.background': '#17151E',
      'editorWidget.border': '#514A5A',
      'focusBorder': '#E7A8C7',
    },
  });
  monaco.editor.setTheme('driftlab-ink');
};
