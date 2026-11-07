import { Data } from 'effect';
import type { ErrorTag, Intent, Note, NoteId, NoteTag, Session, SessionId, Settings } from '../../domain';
import type { ActiveTab, BeforeAfter, ErrorKey, ExportFormatChoice, ExportScope, Filters, PendingDelete } from './state';

/** Keys of `copy.panel.toolbar.helper`. */
export type HelperKey = 'inactive' | 'active' | 'unsupported' | 'permissionDeclined' | 'injectionFailed';

export interface ExportCounts {
  readonly all: number;
  readonly page: number;
  readonly selected: number;
  readonly filtered: number;
}

export interface Shell {
  readonly header: { readonly sessionId: SessionId | null; readonly sessionName: string | null; readonly count: number };
  readonly toolbar: {
    readonly helperKey: HelperKey;
    readonly pickDisabled: boolean;
    readonly active: boolean;
    readonly beforeAfter: BeforeAfter;
  };
  readonly footer: {
    readonly format: ExportFormatChoice;
    readonly scope: ExportScope;
    readonly counts: ExportCounts;
    readonly filterActive: boolean;
    readonly exportDisabled: boolean;
    /** Key under `copy.panel.states` for the reason export is disabled, if any. */
    readonly hintKey: 'exportNothingSelected' | null;
  };
  readonly activeTab: ActiveTab | null;
  readonly pendingDelete: PendingDelete | null;
  readonly errors: Readonly<Partial<Record<ErrorKey, ErrorTag>>>;
  readonly flashId: string | null;
}

export interface RowVm {
  readonly note: Note;
  /** `FV-n`. */
  readonly label: string;
  readonly tags: readonly NoteTag[];
  readonly intent: Intent;
  readonly notFound: boolean;
  readonly selected: boolean;
  readonly hovered: boolean;
}

export interface GroupVm {
  readonly pageKey: string;
  readonly host: string;
  readonly path: string;
  readonly isCurrent: boolean;
  readonly rows: readonly RowVm[];
}

export type Strip = Data.TaggedEnum<{
  NotActivated: { readonly count: number };
  OtherSession: { readonly count: number; readonly sessionName: string; readonly sessionId: SessionId };
}>;
export const Strip = Data.taggedEnum<Strip>();

export interface SessionRowVm {
  readonly session: Session;
  readonly noteCount: number;
  readonly isActive: boolean;
}

export type PanelState = Data.TaggedEnum<{
  Loading: object;
  FirstRun: { readonly shell: Shell; readonly unsupported: boolean };
  EmptySession: { readonly shell: Shell; readonly unsupported: boolean };
  Ready: {
    readonly shell: Shell;
    readonly groups: readonly GroupVm[];
    readonly currentGroup: GroupVm | null;
    readonly otherGroups: readonly GroupVm[];
    readonly emptyCurrentPage: boolean;
    readonly strip: Strip | null;
    readonly unsupported: boolean;
    readonly noResults: { readonly query: string } | null;
    readonly showSearch: boolean;
    readonly search: string;
    readonly filters: Filters;
  };
  Detail: {
    readonly shell: Shell;
    readonly row: RowVm;
    readonly canForceApply: boolean;
    readonly hasShots: { readonly before: boolean; readonly after: boolean };
  };
  Sessions: {
    readonly shell: Shell;
    readonly sessions: readonly SessionRowVm[];
    readonly confirmDelete: { readonly id: SessionId; readonly name: string; readonly noteCount: number } | null;
  };
  Settings: { readonly shell: Shell; readonly settings: Settings; readonly corruptCount: number };
}>;
export const PanelState = Data.taggedEnum<PanelState>();

export type PanelStateTag = PanelState['_tag'];
export type NoteIdSet = ReadonlySet<NoteId>;
