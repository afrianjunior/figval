import { Effect, type Scope } from 'effect';
import { makeFrameScheduler } from '../picker';
import { place, type Side } from './position';

const FALLBACK_SIZE = { w: 320, h: 400 };

export interface FollowOptions {
  readonly doc: Document;
  readonly slot: HTMLElement;
  readonly getAnchor: () => Element;
  readonly onPlacement: (side: Side, offscreen: 'above' | 'below' | null) => void;
  /** Called after every measure so other overlays (match boxes) can follow too. */
  readonly onFrame: () => void;
}

export interface Follower {
  readonly reposition: () => void;
  readonly dragMove: (dx: number, dy: number) => void;
  readonly dragEnd: () => void;
}

const clampInto = (v: number, size: number, limit: number): number =>
  Math.max(0, Math.min(v, Math.max(0, limit - size)));

/** Positions the tooltip beside its element, re-measuring on scroll and resize, with a drag offset on top. */
export const startFollow = (o: FollowOptions): Effect.Effect<Follower, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const win = o.doc.defaultView ?? window;
      let offset = { x: 0, y: 0 };
      let dragBase = offset;
      let last: { side: Side; off: 'above' | 'below' | null } | null = null;

      const reposition = (): void => {
        const r = o.getAnchor().getBoundingClientRect();
        const size = {
          w: o.slot.offsetWidth || FALLBACK_SIZE.w,
          h: o.slot.offsetHeight || FALLBACK_SIZE.h,
        };
        const p = place({
          anchor: { x: r.left, y: r.top, w: r.width, h: r.height },
          size,
          viewport: { w: win.innerWidth, h: win.innerHeight },
        });
        const x = clampInto(p.x + offset.x, size.w, win.innerWidth);
        const y = clampInto(p.y + offset.y, size.h, win.innerHeight);
        o.slot.style.transform = `translate(${x}px, ${y}px)`;
        if (last === null || last.side !== p.side || last.off !== p.offscreen) {
          last = { side: p.side, off: p.offscreen };
          o.onPlacement(p.side, p.offscreen);
        }
        o.onFrame();
      };

      const frame = makeFrameScheduler(win, reposition);
      const resize =
        typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(frame.schedule);
      resize?.observe(o.slot);
      win.addEventListener('scroll', frame.schedule, { capture: true, passive: true });
      win.addEventListener('resize', frame.schedule);

      const follower: Follower = {
        reposition,
        dragMove: (dx, dy) => {
          offset = { x: dragBase.x + dx, y: dragBase.y + dy };
          frame.schedule();
        },
        dragEnd: () => {
          dragBase = offset;
        },
      };
      const stop = (): void => {
        frame.cancel();
        resize?.disconnect();
        win.removeEventListener('scroll', frame.schedule, { capture: true });
        win.removeEventListener('resize', frame.schedule);
      };
      return { follower, stop };
    }),
    ({ stop }) => Effect.sync(stop),
  ).pipe(Effect.map(({ follower }) => follower));
