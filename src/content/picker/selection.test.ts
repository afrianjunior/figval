import { Effect, Exit, Scope } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copy } from '../../copy';
import { startPicker } from './picker';
import { startSelection } from './selection';
import { makeHarness, nextFrame, recordingPort, type Harness } from './test-support';

let h: Harness;
let port: ReturnType<typeof recordingPort>;

const selectText = (el: Element): void => {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = document.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
};
const button = () => h.host.layer.querySelector<HTMLButtonElement>('.fv-ov-addnote');

beforeEach(() => {
  document.body.innerHTML = '<main><p id="p" class="plan-desc">Pick the annual plan</p></main>';
  h = makeHarness();
  port = recordingPort();
});
afterEach(() => {
  document.getSelection()?.removeAllRanges();
  h.close();
});

describe('startSelection', () => {
  it('shows nothing before activation', async () => {
    selectText(document.getElementById('p')!);
    await nextFrame();
    expect(button()).toBeNull();
  });

  it('shows "+ Note" for a non-empty selection once active', async () => {
    const scope = Effect.runSync(Scope.make());
    Effect.runSync(
      startSelection({ doc: document, host: h.host, registry: h.registry }).pipe(
        Effect.provide(port.layer),
        Scope.extend(scope),
      ),
    );
    expect(button()?.hidden).toBe(true);
    selectText(document.getElementById('p')!);
    await nextFrame();
    expect(button()?.hidden).toBe(false);
    expect(button()?.textContent).toBe(copy.picker.addNote);

    document.getSelection()!.removeAllRanges();
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await nextFrame();
    expect(button()?.hidden).toBe(true);

    selectText(document.getElementById('p')!);
    await nextFrame();
    button()!.click();
    expect(port.calls).toHaveLength(1);
    const call = port.calls[0]!;
    expect(call.opts.selectionText).toBe('Pick the annual plan');
    expect(call.opts.anchor.id).toBe('p');
    expect(call.target.selection?.text).toBe('Pick the annual plan');
    expect(button()?.hidden).toBe(true);

    Effect.runSync(Scope.close(scope, Exit.void));
    expect(button()).toBeNull();
  });

  it('ignores selections inside Figval UI', async () => {
    const scope = Effect.runSync(Scope.make());
    Effect.runSync(
      startSelection({ doc: document, host: h.host, registry: h.registry }).pipe(
        Effect.provide(port.layer),
        Scope.extend(scope),
      ),
    );
    selectText(button()!);
    await nextFrame();
    expect(button()?.hidden).toBe(true);
    Effect.runSync(Scope.close(scope, Exit.void));
  });
});

describe('"+ Note" while picking', () => {
  it('opens the tooltip with the selection and stops the picker', async () => {
    const scope = Effect.runSync(Scope.make());
    let finished = 0;
    Effect.runSync(
      Effect.all([
        startSelection({ doc: document, host: h.host, registry: h.registry }),
        startPicker({
          doc: document,
          host: h.host,
          registry: h.registry,
          onFinish: () => void finished++,
        }),
      ]).pipe(Effect.provide(port.layer), Scope.extend(scope)),
    );
    selectText(document.getElementById('p')!);
    await nextFrame();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
    button()!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    expect(port.calls).toHaveLength(1);
    expect(port.calls[0]?.opts.selectionText).toBe('Pick the annual plan');
    expect(port.calls[0]?.opts.anchor.id).toBe('p');
    expect(finished).toBe(1);
    Effect.runSync(Scope.close(scope, Exit.void));
  });
});
