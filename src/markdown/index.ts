import { renderHuman } from './human';
import { renderLlm } from './llm';
import type { ExportFormat, ExportInput } from './types';

export const render = (format: ExportFormat, input: ExportInput): string =>
  format === 'llm' ? renderLlm(input) : renderHuman(input);

export { renderLlm, renderHuman };
export { verifyLine } from './verify';
export { execGraph } from './exec-graph';
export { exportTitle, exportFilename, TITLE_MAX } from './title';
export type { ExportFormat, ExportInput, ExecGraph, ExecEdge, ExecWave, ShotLookup } from './types';
