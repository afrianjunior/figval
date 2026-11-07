export const ERROR_TAGS = [
  'StorageQuotaExceeded',
  'StorageCorrupt',
  'StorageUnavailable',
  'ShotStoreError',
  'UnsupportedPage',
  'PermissionDenied',
  'InjectionFailed',
  'CaptureFailed',
  'ElementNotFound',
  'ClipboardDenied',
  'MessageTimeout',
  'MessageDecodeError',
  'InvariantViolation',
  'NoteSaveError',
  'NoteNotFound',
  'SessionNotFound',
  'InvalidOrder',
  'DownloadFailed',
] as const;

export type ErrorTag = (typeof ERROR_TAGS)[number];

export const errors: Readonly<Record<ErrorTag, string>> = {
  StorageQuotaExceeded: 'Browser storage is full. Delete a note or a session, then try again.',
  StorageCorrupt: "Some saved notes couldn't be read and were skipped. The rest are fine.",
  StorageUnavailable:
    "Figval can't reach browser storage right now. Reload the extension and try again.",
  ShotStoreError: "The screenshot couldn't be saved or loaded. The note is still saved.",
  UnsupportedPage:
    "Figval can't run on this page. Switch to a regular website tab to pick elements.",
  PermissionDenied:
    "Site access was declined, so Figval can't pick elements here. Choose Try again to allow it.",
  InjectionFailed: "Figval couldn't start on this page. Reload the page and try again.",
  CaptureFailed: 'The note was saved without a screenshot.',
  ElementNotFound:
    "Figval can't find this element on the page anymore. The page may have changed. The note is still saved.",
  ClipboardDenied: 'The browser blocked copying. Download the .md file instead.',
  MessageTimeout: "Figval didn't answer in time. Try again.",
  MessageDecodeError: "Figval got a reply it couldn't read. Try again.",
  InvariantViolation: 'Something broke inside Figval. Reload the extension and try again.',
  NoteSaveError: "The note wasn't saved. Your changes are still here, so try again.",
  NoteNotFound: 'That note no longer exists. Pick another note from the list.',
  SessionNotFound:
    'That session no longer exists. Pick another one from the session switcher, or start a new one.',
  InvalidOrder: "The notes couldn't be reordered. Drag the note again.",
  DownloadFailed: "The download didn't finish. Try again, or use Copy markdown.",
};
