import { count, plural } from './plural';
import { defaultSessionName } from './format';

type MetaState = 'before' | 'after' | 'rest' | 'hover' | 'focus';

const noteCount = (n: number): string => count(n, 'note', 'notes');

export const panel = {
  header: {
    sessionSwitcherLabel: 'Switch session',
    noSession: 'No session yet',
    sessionTitle: (name: string, n: number): string => `${name} (${n})`,
    menuLabel: 'Session menu',
    menu: { settings: 'Settings', rename: 'Rename', deleteSession: 'Delete session' },
  },
  toolbar: {
    pick: 'Pick element',
    before: 'Before',
    after: 'After',
    toggleLabel: 'Page view',
    helper: {
      inactive: 'Pick an element, or select text on the page.',
      active: 'Click any element on the page, or select text to add a note.',
      picking: 'Click the element you want to note. Esc cancels.',
      unsupported: "Figval can't run on this page.",
      permissionDeclined:
        "Site access was declined, so Figval can't pick elements here. Choose Try again to allow it.",
      injectionFailed: "Figval couldn't start on this page. Reload the page and try again.",
    },
    retry: 'Try again',
    reloadHint: 'Reload the page',
  },
  search: {
    placeholder: 'Search notes',
    hint: { mac: '⌘F', other: 'Ctrl+F' },
    clearLabel: 'Clear search',
    chips: {
      text: 'text',
      style: 'style',
      hide: 'hide',
      comment: 'comment',
      apply: 'apply',
      propose: 'propose',
      notFound: 'not found',
    },
  },
  list: {
    groupThisPage: 'this page',
    emptyCurrentPage: 'No notes on this page yet.',
    pageCount: (n: number): string => String(n),
    badge: { propose: 'propose', notFound: 'not found' },
    thumbnailAlt: (id: string): string => `Screenshot for ${id}`,
    selectRow: (id: string): string => `Select ${id} for export`,
    dragHandle: 'Drag to reorder',
    rowLabel: (id: string, label: string): string => `${id} ${label}`,
  },
  states: {
    firstRun: {
      line: 'Pick an element or select text on the page to leave your first note.',
      cta: 'Pick element',
    },
    emptySession: {
      line: 'This session has no notes yet. Pick an element or select text to add one.',
    },
    emptyCurrentPage: { line: 'No notes on this page yet.' },
    unsupported: { line: "Figval can't run on this page. Your notes and export still work." },
    notActivated: {
      strip: (n: number): string => `${noteCount(n)} on this page`,
      action: 'Show',
    },
    otherSession: {
      strip: (n: number, sessionName: string): string => `${noteCount(n)} in "${sessionName}"`,
      action: 'Open',
    },
    notFound: {
      badge: 'not found',
      explanation:
        "Figval can't find this element on the page anymore. The page may have changed. The note and its screenshot are still saved.",
    },
    noResults: {
      line: (query: string): string => `No notes match "${query}".`,
      filterLine: 'No notes match these filters.',
      reset: 'Reset filters',
    },
    loading: 'Loading notes',
    storageError: { line: "The note wasn't saved. Your changes are still here, so try again." },
    exportNothingSelected: { hint: 'Check at least one note to export.' },
  },
  detail: {
    back: 'Back',
    title: (id: string, label: string): string => `${id} · ${label}`,
    menuLabel: 'Note menu',
    meta: (path: string, width: number, height: number, state: MetaState): string =>
      `${path} · ${width}×${height} · ${state}`,
    comment: 'Comment',
    why: 'Why',
    addReason: '+ Add reason',
    letAgentApply: 'Let the agent apply this',
    changes: 'Changes',
    rows: { text: 'Text', style: 'Style', scope: 'Scope' },
    changeTo: 'to',
    textChange: (before: string, after: string): string => `"${before}" → "${after}"`,
    styleChange: (property: string, before: string, after: string): string =>
      `${property}  ${before} → ${after}`,
    scopeAll: (n: number): string => `all similar (${n})`,
    scopeOne: 'this element',
    editOnPage: 'Edit on page',
    screenshot: 'Screenshot',
    copyBefore: 'Copy before screenshot',
    copyAfter: 'Copy after screenshot',
    noScreenshot: 'No screenshot',
    locator: 'Locator',
    locatorParts: { domPath: 'DOM path', selector: 'Selector', html: 'HTML' },
    changeGroups: {
      text: 'Text',
      fill: 'Fill',
      typography: 'Typography',
      layout: 'Layout',
      visibility: 'Visibility',
    },
    deleteNote: 'Delete note',
    notFoundExplanation:
      "Figval can't find this element on the page anymore. The page may have changed. The note and its screenshot are still saved.",
  },
  footer: {
    format: { llm: 'LLM', human: 'Human', label: 'Export format' },
    scope: {
      label: 'Export scope',
      allPages: 'All pages',
      thisPage: 'This page',
      selected: (n: number): string => `Selected (${n})`,
      filtered: (n: number): string => `Filter results (${n})`,
    },
    copyMarkdown: 'Copy markdown',
    download: 'Download .md',
    copied: 'Copied',
  },
  sessions: {
    title: 'Sessions',
    newSession: 'New session',
    rename: 'Rename',
    renameLabel: 'Session name',
    delete: 'Delete',
    noteCount: (n: number): string => noteCount(n),
    deleteDialog: {
      title: (name: string): string => `Delete "${name}"?`,
      body: (n: number): string =>
        n === 0
          ? "This deletes the session. This can't be undone."
          : `This deletes ${plural(n, 'the note', `all ${n} notes`)} and every screenshot in this session. This can't be undone.`,
      confirm: 'Delete session',
      cancel: 'Cancel',
    },
    defaultName: defaultSessionName,
  },
  settings: {
    title: 'Settings',
    preset: 'Preset',
    presets: { developer: 'Developer', reviewer: 'Reviewer' },
    screenshots: 'Screenshots',
    screenshotsOn: 'On',
    screenshotsOff: 'Off',
    corrupt: (n: number): string =>
      `${count(n, 'saved note', 'saved notes')} couldn't be read and ${plural(n, 'was', 'were')} skipped.`,
  },
} as const;
