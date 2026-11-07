import { Effect, type Scope } from 'effect';
import type { Note, Target } from '../../domain';
import type { MessengerService } from '../../messaging';
import type {
  NoteRepoService,
  SessionKvService,
  SessionRepoService,
  SettingsRepoService,
} from '../../storage';
import type { TooltipOpenOptions } from '../picker';
import type { Boot } from './boot';
import type { DraftWriter } from './drafts';
import type { MatchHighlighter } from './matches';
import type { Previewer } from './preview';
import type { Store } from './store';
import type { TextRow } from './textrow';

export interface TooltipDeps {
  readonly messenger: MessengerService;
  readonly sessionStore: SessionKvService;
  readonly settings: SettingsRepoService;
  readonly sessions: SessionRepoService;
  readonly notes: NoteRepoService;
}

/** Everything one open tooltip shares between its parts. `ref` and `flags` are DOM-side bookkeeping. */
export interface SessionCtx {
  readonly deps: TooltipDeps;
  readonly target: Target;
  readonly opts: TooltipOpenOptions;
  readonly doc: Document;
  readonly draftKey: string;
  readonly boot: Boot;
  readonly scope: Scope.CloseableScope;
  /** Every fire-and-forget fiber goes through this so it cannot outlive the tooltip. */
  readonly fork: ForkInScope;
  readonly store: Store;
  readonly previewer: Previewer;
  readonly matches: MatchHighlighter;
  readonly drafts: DraftWriter;
  readonly textRow: TextRow;
  readonly previousFocus: Element | null;
  /** The element being edited; replaced when the page re-renders it. */
  readonly ref: { el: Element };
  readonly flags: { closed: boolean };
}

/** Runs `effect` as a fiber owned by `scope`: closing the tooltip interrupts it. */
export type ForkInScope = (effect: Effect.Effect<void>) => void;

export const makeFork =
  (scope: Scope.Scope): ForkInScope =>
  (effect) => {
    Effect.runFork(Effect.forkIn(effect, scope));
  };

export type RestoreAfterClose = (note: Note | null) => void;
