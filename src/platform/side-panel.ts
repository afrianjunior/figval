import { Context, Effect, Layer } from 'effect';
import { chromeApi } from './chrome-api';
import { TestRecorder } from './test-driver';

export interface SidePanelService {
  /** Background passes false so `action.onClicked` fires; ActionLive opens the panel itself. */
  readonly setPanelBehavior: (openPanelOnActionClick: boolean) => Effect.Effect<void>;
  readonly open: (tabId: number) => Effect.Effect<void>;
}

export class SidePanel extends Context.Tag('figval/platform/SidePanel')<SidePanel, SidePanelService>() {}

export const SidePanelLive: Layer.Layer<SidePanel> = Layer.succeed(SidePanel, {
  setPanelBehavior: (openPanelOnActionClick) =>
    Effect.tryPromise(() => chromeApi().sidePanel.setPanelBehavior({ openPanelOnActionClick })).pipe(Effect.orDie),
  open: (tabId) => Effect.tryPromise(() => chromeApi().sidePanel.open({ tabId })).pipe(Effect.orDie),
});

export const SidePanelTest: Layer.Layer<SidePanel, never, TestRecorder> = Layer.effect(
  SidePanel,
  Effect.map(TestRecorder, (recorder): SidePanelService => ({
    setPanelBehavior: (value) => recorder.record({ service: 'SidePanel', op: 'setPanelBehavior', args: [value] }),
    open: (tabId) => recorder.record({ service: 'SidePanel', op: 'open', args: [tabId] }),
  })),
);
