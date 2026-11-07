import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  Badge,
  Button,
  Checkbox,
  Chip,
  ColorRow,
  Dialog,
  Field,
  IconButton,
  Input,
  Kbd,
  LayerRow,
  Pin,
  PropertyRow,
  PropertySection,
  ScrubNumber,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Swatch,
  Textarea,
  Toast,
  icons,
  uiCss,
  normalizeHex,
} from './index';

describe('simple primitives', () => {
  it('Button exposes name and fires onClick; disabled blocks it', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Copy</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button disabled onClick={onClick}>
        Copy
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('IconButton is named by its label', () => {
    render(<IconButton label="Close" icon={icons.close} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('Field labels its control and wires the error', () => {
    render(
      <Field label="Name" error="Required">
        {(c) => <Input {...c} />}
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required');
  });

  it('Textarea and Select have roles', () => {
    render(
      <>
        <Textarea aria-label="Comment" defaultValue="hi" autosize />
        <Select
          aria-label="Weight"
          value="400"
          onChange={() => {}}
          options={[{ value: '400', label: 'Regular' }]}
        />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Weight' })).toBeInTheDocument();
  });

  it('Checkbox toggles with a label', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Apply" onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Apply' }));
    expect(onChange).toHaveBeenCalled();
  });

  it('Slider has slider role and reports numbers', () => {
    const onChange = vi.fn();
    render(<Slider label="Radius" value={4} min={0} max={32} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Radius' });
    fireEvent.change(slider, { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it('Chip toggles aria-pressed', async () => {
    const Harness = () => {
      const [on, setOn] = useState(false);
      return (
        <Chip pressed={on} onPressedChange={setOn}>
          text
        </Chip>
      );
    };
    render(<Harness />);
    const chip = screen.getByRole('button', { name: 'text' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('Badge, Kbd, Skeleton, Swatch render', () => {
    render(
      <>
        <Badge tone="missing">not found</Badge>
        <Kbd>Esc</Kbd>
        <Skeleton data-testid="sk" />
        <Swatch color="#ff0000" label="#FF0000" />
      </>,
    );
    expect(screen.getByText('not found')).toHaveClass('fv-badge--missing');
    expect(screen.getByText('Esc').tagName).toBe('KBD');
    expect(screen.getByTestId('sk')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: '#FF0000' })).toBeInTheDocument();
  });

  it('Toast is a status region with an action slot', () => {
    render(<Toast message="Deleted" action={<Button>Undo</Button>} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Deleted');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('PropertySection shows reset only with changes', async () => {
    const onReset = vi.fn();
    const { rerender } = render(
      <PropertySection title="Fill" onReset={onReset} resetLabel="Reset Fill">
        x
      </PropertySection>,
    );
    expect(screen.queryByRole('button', { name: 'Reset Fill' })).toBeNull();
    rerender(
      <PropertySection title="Fill" hasChanges onReset={onReset} resetLabel="Reset Fill">
        x
      </PropertySection>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reset Fill' }));
    expect(onReset).toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Fill' })).toBeInTheDocument();
  });

  it('PropertyRow shows changed state and per-control reset', async () => {
    const onReset = vi.fn();
    render(
      <PropertyRow
        label="Size"
        changed
        changedLabel="changed"
        onReset={onReset}
        resetLabel="Reset Size"
      >
        <span>14</span>
      </PropertyRow>,
    );
    expect(screen.getByRole('group', { name: /Size/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reset Size' }));
    expect(onReset).toHaveBeenCalled();
  });

  it('LayerRow selects, marks current and takes a checkbox slot', async () => {
    const onSelect = vi.fn();
    render(
      <ul>
        <LayerRow
          title="Sign-up button"
          meta="text"
          selected
          leading={<Checkbox aria-label="Include" />}
          onSelect={onSelect}
        />
      </ul>,
    );
    const main = screen.getByRole('button', { name: /Sign-up button/ });
    expect(main).toHaveAttribute('aria-current', 'true');
    await userEvent.click(main);
    expect(onSelect).toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'Include' })).toBeInTheDocument();
  });

  it('Pin shows a preview tooltip slot', () => {
    render(
      <Pin aria-label="Note FV-3" preview="Too loud">
        FV-3
      </Pin>,
    );
    expect(screen.getByRole('button', { name: 'Note FV-3' })).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Too loud');
  });

  it('Pin links the button to its preview via aria-describedby', () => {
    render(
      <Pin aria-label="Note FV-3" preview="Too loud">
        FV-3
      </Pin>,
    );
    const tip = screen.getByRole('tooltip');
    expect(tip.id).not.toBe('');
    expect(screen.getByRole('button', { name: 'Note FV-3' })).toHaveAttribute(
      'aria-describedby',
      tip.id,
    );
  });

  it('Pin Escape dismisses the preview until pointer leave or blur', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Pin aria-label="Note FV-3" preview="Too loud">
        FV-3
      </Pin>,
    );
    const root = container.querySelector('.fv-pin') as HTMLElement;
    await user.tab();
    expect(root).not.toHaveAttribute('data-dismissed');
    await user.keyboard('{Escape}');
    expect(root).toHaveAttribute('data-dismissed');
    fireEvent.pointerLeave(root);
    expect(root).not.toHaveAttribute('data-dismissed');
    await user.keyboard('{Escape}');
    expect(root).toHaveAttribute('data-dismissed');
    await user.tab();
    expect(root).not.toHaveAttribute('data-dismissed');
  });

  it('uiCss is exported as a string', () => {
    expect(typeof uiCss).toBe('string');
  });
});

describe('Segmented', () => {
  const options = [
    { value: 'l', icon: icons.alignLeft, ariaLabel: 'Left' },
    { value: 'c', icon: icons.alignCenter, ariaLabel: 'Center' },
    { value: 'r', icon: icons.alignRight, ariaLabel: 'Right' },
  ];
  const Harness = () => {
    const [v, setV] = useState('l');
    return <Segmented label="Align" options={options} value={v} onChange={setV} />;
  };

  it('is a radiogroup and arrow keys move selection with wrap', async () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Align' })).toBeInTheDocument();
    const left = screen.getByRole('radio', { name: 'Left' });
    left.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Center' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Center' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Right' })).toBeChecked();
  });
});

describe('ScrubNumber', () => {
  const Harness = ({ onChange }: { onChange?: (v: number) => void }) => {
    const [v, setV] = useState(16);
    return (
      <ScrubNumber
        label="Font size"
        handle="T"
        value={v}
        min={0}
        max={100}
        unit="px"
        onChange={(n) => {
          setV(n);
          onChange?.(n);
        }}
      />
    );
  };

  it('Escape stops propagation only when a draft exists', async () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Harness />
      </div>,
    );
    const input = screen.getByRole('spinbutton', { name: 'Font size' });
    input.focus();
    await userEvent.keyboard('{Escape}');
    expect(outer).toHaveBeenCalledTimes(1);
    outer.mockClear();
    await userEvent.keyboard('9');
    await userEvent.keyboard('{Escape}');
    expect(outer).toHaveBeenCalledTimes(1);
    expect(outer.mock.calls[0]?.[0].key).toBe('9');
    expect(input).toHaveValue('16');
  });

  it('arrow keys change by 1, Shift by 10, and clamp', async () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'Font size' });
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveValue('17');
    await userEvent.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(input).toHaveValue('27');
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveValue('26');
  });

  it('accepts typed values on Enter and clamps to max', async () => {
    render(<Harness />);
    const input = screen.getByRole('spinbutton', { name: 'Font size' });
    await userEvent.clear(input);
    await userEvent.type(input, '250{Enter}');
    expect(input).toHaveValue('100');
  });

  it('drag on the handle scrubs, Shift multiplies, pointer capture is released', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const handle = screen.getByTestId('scrub-handle');
    const capture = vi.fn();
    const release = vi.fn();
    Object.assign(handle, {
      setPointerCapture: capture,
      hasPointerCapture: () => true,
      releasePointerCapture: release,
    });
    fireEvent.pointerDown(handle, { pointerId: 1, clientX: 100, button: 0 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 105 });
    expect(onChange).toHaveBeenLastCalledWith(21);
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 102, shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(36);
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(capture).toHaveBeenCalledWith(1);
    expect(release).toHaveBeenCalledWith(1);
    onChange.mockClear();
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 400 });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ColorRow', () => {
  it('normalizes hex and applies a typed value', async () => {
    expect(normalizeHex('f0a')).toBe('#FF00AA');
    expect(normalizeHex('zzz')).toBeNull();
    const onChange = vi.fn();
    render(
      <ColorRow
        value="#FF2D55"
        onChange={onChange}
        swatches={['#0F62FE']}
        swatchButtonLabel="Open picker"
        hexLabel="Hex"
        pickerLabel="Picker"
        swatchesLabel="Page colors"
      />,
    );
    const hex = screen.getByRole('textbox', { name: 'Hex' });
    await userEvent.clear(hex);
    await userEvent.type(hex, '0f62fe{Enter}');
    expect(onChange).toHaveBeenCalledWith('#0F62FE');
  });

  it('swatch opens the picker with page swatches and Esc closes it', async () => {
    const onChange = vi.fn();
    render(
      <ColorRow
        value="#FF2D55"
        onChange={onChange}
        swatches={['#0F62FE']}
        swatchButtonLabel="Open picker"
        hexLabel="Hex"
        pickerLabel="Picker"
        swatchesLabel="Page colors"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open picker' }));
    expect(screen.getByRole('group', { name: 'Page colors' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '#0F62FE' }));
    expect(onChange).toHaveBeenCalledWith('#0F62FE');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: 'Picker' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open picker' })).toHaveFocus();
  });
});

describe('Dialog', () => {
  const Harness = ({ onClose }: { onClose?: () => void }) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Delete session</button>
        <Dialog
          open={open}
          title="Delete session?"
          onClose={() => {
            setOpen(false);
            onClose?.();
          }}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger">Delete</Button>
            </>
          }
        >
          Screenshots are lost.
        </Dialog>
      </>
    );
  };

  it('has dialog semantics and focuses inside on open', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete session?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('traps Tab in both directions', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
  });

  it('Esc closes and focus returns to the opener', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Delete session' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
