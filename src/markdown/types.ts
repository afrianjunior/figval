import type { Note, NoteId, Session } from '../domain';

export type ExportFormat = 'llm' | 'human';

/** Which notes have a screenshot the human export may point to. */
export type ShotLookup = ReadonlySet<NoteId> | ((note: Note) => boolean);

export interface ExportInput {
  readonly session: Session;
  /** Already filtered and ordered by the caller. */
  readonly notes: readonly Note[];
  /** Export time, epoch ms. Rendered in UTC. */
  readonly now: number;
  /** Absent: a note has a shot when it holds a stored shot id. */
  readonly shots?: ShotLookup;
}

export interface ExecWave {
  readonly level: number;
  readonly seqs: readonly number[];
}

export interface ExecEdge {
  readonly from: number;
  readonly to: number;
  readonly reason: string;
}

export interface ExecGraph {
  readonly waves: readonly ExecWave[];
  readonly edges: readonly ExecEdge[];
}
