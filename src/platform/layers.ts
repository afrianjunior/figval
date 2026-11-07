import { Layer } from 'effect';
import { ActionLive, ActionTest } from './action';
import { CaptureLive, CaptureTest } from './capture';
import { ClipboardLive, ClipboardTest } from './clipboard';
import { ClockFixed, ClockLive } from './clock';
import { CommandsLive, CommandsTest } from './commands';
import { DownloadLive, DownloadTest } from './download';
import { IdsLive, IdsSequence } from './ids';
import { PermissionsLive, PermissionsTest, type PermissionsTestConfig } from './permissions';
import { ScriptingLive, ScriptingTest, type ScriptingTestConfig } from './scripting';
import { SidePanelLive, SidePanelTest } from './side-panel';
import { TabsLive, TabsTest } from './tabs';
import { TestDriverLive, TestRecorderLive } from './test-driver';
import type { CaptureTestConfig } from './capture';
import type { ClipboardTestConfig } from './clipboard';
import type { TabId } from '../domain';
import type { TabInfo } from './types';

export const PlatformLive = Layer.mergeAll(
  TabsLive,
  ScriptingLive,
  PermissionsLive,
  CaptureLive,
  ClipboardLive,
  DownloadLive,
  ClockLive,
  IdsLive,
  SidePanelLive,
  CommandsLive,
  ActionLive,
);

export interface PlatformTestConfig {
  readonly tabs?: readonly TabInfo[];
  readonly activeTabId?: TabId | null;
  readonly now?: number;
  readonly permissions?: PermissionsTestConfig;
  readonly scripting?: ScriptingTestConfig;
  readonly capture?: CaptureTestConfig;
  readonly clipboard?: ClipboardTestConfig;
}

/** Every platform service backed by test layers; also provides TestRecorder and TestDriver. */
export const PlatformTest = (config: PlatformTestConfig = {}) => {
  const base = Layer.merge(TestRecorderLive, TestDriverLive(config.tabs ?? [], config.activeTabId ?? null));
  const services = Layer.mergeAll(
    TabsTest,
    ScriptingTest(config.scripting),
    PermissionsTest(config.permissions),
    CaptureTest(config.capture),
    ClipboardTest(config.clipboard),
    DownloadTest,
    ClockFixed(config.now ?? 0),
    IdsSequence,
    SidePanelTest,
    CommandsTest,
    ActionTest,
  );
  return Layer.provideMerge(services, base);
};
