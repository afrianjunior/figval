import { Layer } from 'effect';
import { createRoot } from 'react-dom/client';
import { MessengerLive } from '../../messaging';
import { PlatformLive } from '../../platform';
import { App, sidePanelCss } from '../../sidepanel/ui';
import { createPanelStore, type PanelEnv } from '../../sidepanel/model';
import { StorageLive } from '../../storage';
import { buildFontFaceCss, uiCss } from '../../ui';

/** `?tab=<id>` binds the panel to one tab (test mode, spec §9). */
const boundTabId = (search: string): number | undefined => {
  const raw = new URLSearchParams(search).get('tab');
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  return Number(raw);
};

const injectStyles = (css: string): void => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
};

const layer = Layer.mergeAll(StorageLive, PlatformLive, MessengerLive) as Layer.Layer<PanelEnv>;

const mount = (): void => {
  const container = document.getElementById('root');
  if (container === null) return;
  injectStyles(buildFontFaceCss((path) => path));
  injectStyles(uiCss);
  injectStyles(sidePanelCss);
  const tab = boundTabId(location.search);
  const store = createPanelStore(layer, tab === undefined ? {} : { boundTabId: tab });
  window.addEventListener('pagehide', () => void store.dispose());
  createRoot(container).render(<App store={store} />);
};

mount();
