export const tooltip = {
  tabs: { comment: 'Comment', edit: 'Edit' },
  header: { labelPlaceholder: 'Label this note', close: 'Close', provisionalId: (seq: number): string => `FV-${seq}` },
  comment: {
    placeholder: 'What should change, and why?',
    addReason: '+ Add reason',
    reasonPlaceholder: 'Why does it need to change?',
    forceApply: 'Let the agent apply this',
  },
  actions: { cancel: 'Cancel', save: 'Save' },
  selection: { quoteLabel: 'Selected text' },
  edit: {
    sections: {
      text: 'Text',
      fill: 'Fill',
      typography: 'Typography',
      layout: 'Layout',
      visibility: 'Visibility',
    },
    controls: {
      textColor: 'Text color',
      background: 'Background',
      fontSize: 'Font size',
      fontWeight: 'Font weight',
      paddingVertical: 'Padding vertical',
      paddingHorizontal: 'Padding horizontal',
      radius: 'Radius',
      textAlign: 'Text align',
      alignLeft: 'Align left',
      alignCenter: 'Align center',
      alignRight: 'Align right',
      hide: 'Hide this element',
    },
    scope: {
      label: 'Scope',
      onlyThis: 'Only this',
      allSimilar: (n: number): string => `All similar (${n})`,
    },
    resetAll: 'Reset all',
    reset: 'Reset',
    changedDot: 'Changed',
    noEditableText: "This element has no text to edit. Use the style controls instead.",
    editing: (selector: string): string => `Editing: ${selector}`,
    textSummary: (before: string, after: string): string => `"${before}" → "${after}"`,
  },
  scroll: { above: '↑ element above', below: '↓ element below' },
  status: {
    reapplied: 'Element changed, edits re-applied',
    elementGone: "This element is gone from the page. You can still save your note as a comment.",
    saveFailed: "Couldn't save. Your note is still here, so try again.",
    discardConfirm: 'Press Esc again to discard',
  },
  draft: {
    resume: (id: string): string => `Resume draft ${id}?`,
    resumeAction: 'Resume',
    discardAction: 'Discard',
  },
} as const;

export const picker = {
  addNote: '+ Note',
  hint: {
    cancel: 'to cancel',
    parentChild: 'parent / child',
  },
  labelChip: (selector: string, width: number, height: number): string =>
    `${selector}  ${width} × ${height}`,
} as const;

export const keys = {
  submit: '⌘↵',
  submitOther: 'Ctrl+↵',
  escape: 'Esc',
  toggleShortcut: '⌥⇧F',
  up: '↑',
  down: '↓',
} as const;

export const toasts = {
  deleted: 'Deleted',
  undo: 'Undo',
  copied: 'Copied to clipboard',
  downloaded: 'Downloaded',
  clipboardDenied: 'The browser blocked copying.',
  clipboardDeniedAction: 'Download .md instead',
} as const;
