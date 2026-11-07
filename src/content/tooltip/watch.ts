import { findElement } from '../../locator';
import { makeFrameScheduler } from '../picker';
import type { Follower } from './follow';
import type { SessionCtx } from './session';

/** Notices when the page re-renders or removes the element; returns a stop function. */
export const watchElement = (ctx: SessionCtx, follower: Follower): (() => void) => {
  const { doc, store, previewer, target, ref, flags } = ctx;
  const win = doc.defaultView ?? window;
  const check = makeFrameScheduler(win, () => {
    if (flags.closed || ref.el.isConnected) return;
    const found = findElement(target, doc);
    if (!found) {
      store.dispatch({ type: 'elementStatus', value: 'gone' });
      store.dispatch({ type: 'tab', value: 'comment' });
      return;
    }
    ref.el = found;
    previewer.setElement(found);
    store.dispatch({ type: 'elementStatus', value: 'reapplied' });
    follower.reposition();
  });
  const observer = new MutationObserver(check.schedule);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => {
    observer.disconnect();
    check.cancel();
  };
};
