export interface FrameScheduler {
  readonly schedule: () => void;
  readonly cancel: () => void;
}

/** Coalesces many triggers into one `run` per animation frame. */
export const makeFrameScheduler = (win: Window, run: () => void): FrameScheduler => {
  let frame = 0;
  return {
    schedule: () => {
      if (frame !== 0) return;
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        run();
      });
    },
    cancel: () => {
      if (frame === 0) return;
      win.cancelAnimationFrame(frame);
      frame = 0;
    },
  };
};
