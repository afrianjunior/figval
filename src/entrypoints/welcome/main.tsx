import { Layer } from 'effect';
import { createRoot } from 'react-dom/client';
import { MessengerLive } from '../../messaging';
import { PlatformLive } from '../../platform';
import { StorageLive } from '../../storage';
import { buildFontFaceCss, uiCss } from '../../ui';
import { createWelcomeStore, type WelcomeEnv } from '../../welcome/model';
import { WelcomeApp, welcomePageCss } from '../../welcome/ui';

const injectStyles = (css: string): void => {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
};

const layer = Layer.mergeAll(StorageLive, PlatformLive, MessengerLive) as Layer.Layer<WelcomeEnv>;

const mount = (): void => {
  const container = document.getElementById('root');
  if (container === null) return;
  injectStyles(buildFontFaceCss((path) => path));
  injectStyles(uiCss);
  injectStyles(welcomePageCss);
  const store = createWelcomeStore(layer);
  window.addEventListener('pagehide', () => void store.dispose());
  createRoot(container).render(<WelcomeApp store={store} />);
};

mount();
