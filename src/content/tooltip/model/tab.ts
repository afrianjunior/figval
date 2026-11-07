import type { Preset, TooltipTab } from '../../../domain';

/** Reviewers start on Comment; developers return to the tab they used last. */
export const defaultTab = (preset: Preset, last: TooltipTab): TooltipTab =>
  preset === 'reviewer' ? 'comment' : last;
