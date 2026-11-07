import { copy } from '../../../copy';
import type { StyleProperty } from '../../../domain';
import {
  Button,
  Checkbox,
  ColorRow,
  PropertyRow,
  PropertySection,
  ScrubNumber,
  Segmented,
  Select,
  Textarea,
  icons,
} from '../../../ui';
import { changedProps, styleValue } from '../model/selectors';
import type { Action, TooltipState } from '../model/state';
import { ScopeRow } from './ScopeRow';

const t = copy.tooltip.edit;
const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'] as const;
const PADDING_MAX = 200;
const SIZE_MAX = 200;
const RADIUS_MAX = 200;

const px = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};
/** Standard weights, plus the element's own value when it sits between them. */
export const weightOptions = (current: string): { value: string; label: string }[] => {
  const values = WEIGHTS.includes(current as (typeof WEIGHTS)[number])
    ? [...WEIGHTS]
    : [...WEIGHTS, current].sort((a, b) => Number(a) - Number(b));
  return values.map((value) => ({ value, label: t.fontWeightOption(Number(value)) }));
};
const alignOf = (value: string): 'left' | 'center' | 'right' =>
  value === 'center' ? 'center' : value === 'right' || value === 'end' ? 'right' : 'left';

export interface EditTabProps {
  readonly state: TooltipState;
  readonly dispatch: (action: Action) => void;
  readonly swatches: readonly string[];
  readonly selector: string;
  readonly onTextActive: (active: boolean) => void;
  readonly onHoverSimilar: (hovering: boolean) => void;
}

export function EditTab({
  state,
  dispatch,
  swatches,
  selector,
  onTextActive,
  onHoverSimilar,
}: EditTabProps) {
  const changed = changedProps(state);
  const set = (prop: StyleProperty) => (value: string) => dispatch({ type: 'style', prop, value });
  const reset = (...props: StyleProperty[]) => dispatch({ type: 'resetStyle', props });
  const row = (prop: StyleProperty, label: string, control: React.ReactNode) => (
    <PropertyRow
      label={label}
      changed={changed.has(prop)}
      changedLabel={t.changedDot}
      resetLabel={t.reset}
      onReset={() => reset(prop)}
    >
      {control}
    </PropertyRow>
  );
  const any = (...props: StyleProperty[]) => props.some((p) => changed.has(p));
  const color = (prop: StyleProperty, label: string) =>
    row(
      prop,
      label,
      <ColorRow
        value={styleValue(state, prop)}
        onChange={set(prop)}
        swatches={swatches}
        swatchButtonLabel={t.colorRow.openPicker}
        hexLabel={t.colorRow.hexField}
        pickerLabel={t.colorRow.picker}
        swatchesLabel={t.colorRow.pageSwatches}
      />,
    );
  const hidden = state.controls.hidden;
  const textChanged = state.controls.text !== null && state.controls.text !== state.baseline.text;
  const anyChange = textChanged || changed.size > 0 || hidden;

  return (
    <div className="fv-tip__pane fv-tip__pane--edit">
      <div className="fv-tip__editing">
        <span className="fv-tip__selector fv-mono" title={selector}>
          {t.editing(selector)}
        </span>
        {anyChange ? (
          <Button variant="ghost" icon={icons.reset} onClick={() => dispatch({ type: 'resetAll' })}>
            {t.resetAll}
          </Button>
        ) : null}
      </div>
      <PropertySection
        title={t.sections.text}
        hasChanges={textChanged}
        resetLabel={t.reset}
        onReset={() => dispatch({ type: 'text', value: null })}
      >
        {state.baseline.hasEditableText ? (
          <Textarea
            autosize
            rows={2}
            aria-label={t.sections.text}
            value={state.controls.text ?? state.baseline.text ?? ''}
            onFocus={() => onTextActive(true)}
            onBlur={() => onTextActive(false)}
            onChange={(e) =>
              dispatch({
                type: 'text',
                value: e.target.value === state.baseline.text ? null : e.target.value,
              })
            }
          />
        ) : (
          <p className="fv-tip__note">{t.noEditableText}</p>
        )}
      </PropertySection>
      <fieldset className="fv-tip__fields" disabled={hidden}>
        <PropertySection
          title={t.sections.fill}
          hasChanges={any('color', 'background-color')}
          resetLabel={t.reset}
          onReset={() => reset('color', 'background-color')}
        >
          {color('color', t.controls.textColor)}
          {color('background-color', t.controls.background)}
        </PropertySection>
        <PropertySection
          title={t.sections.typography}
          hasChanges={any('font-size', 'font-weight', 'text-align')}
          resetLabel={t.reset}
          onReset={() => reset('font-size', 'font-weight', 'text-align')}
        >
          {row(
            'font-size',
            t.controls.fontSize,
            <ScrubNumber
              label={t.controls.fontSize}
              handle={t.handles.fontSize}
              unit="px"
              min={1}
              max={SIZE_MAX}
              value={px(styleValue(state, 'font-size'))}
              onChange={(n) => set('font-size')(`${n}px`)}
            />,
          )}
          {row(
            'font-weight',
            t.controls.fontWeight,
            <Select
              aria-label={t.controls.fontWeight}
              options={weightOptions(styleValue(state, 'font-weight'))}
              value={styleValue(state, 'font-weight')}
              onChange={set('font-weight')}
            />,
          )}
          {row(
            'text-align',
            t.controls.textAlign,
            <Segmented
              label={t.controls.textAlign}
              value={alignOf(styleValue(state, 'text-align'))}
              onChange={set('text-align')}
              options={[
                { value: 'left', icon: icons.alignLeft, ariaLabel: t.controls.alignLeft },
                { value: 'center', icon: icons.alignCenter, ariaLabel: t.controls.alignCenter },
                { value: 'right', icon: icons.alignRight, ariaLabel: t.controls.alignRight },
              ]}
            />,
          )}
        </PropertySection>
        <PropertySection
          title={t.sections.layout}
          hasChanges={any('padding-block', 'padding-inline', 'border-radius')}
          resetLabel={t.reset}
          onReset={() => reset('padding-block', 'padding-inline', 'border-radius')}
        >
          {(['padding-block', 'padding-inline'] as const).map((prop) => {
            const vertical = prop === 'padding-block';
            const label = vertical ? t.controls.paddingVertical : t.controls.paddingHorizontal;
            return row(
              prop,
              label,
              <ScrubNumber
                label={label}
                handle={vertical ? t.handles.paddingVertical : t.handles.paddingHorizontal}
                unit="px"
                min={0}
                max={PADDING_MAX}
                value={px(styleValue(state, prop))}
                onChange={(n) => set(prop)(`${n}px`)}
              />,
            );
          })}
          {row(
            'border-radius',
            t.controls.radius,
            <ScrubNumber
              label={t.controls.radius}
              handle={t.handles.radius}
              unit="px"
              min={0}
              max={RADIUS_MAX}
              value={px(styleValue(state, 'border-radius'))}
              onChange={(n) => set('border-radius')(`${n}px`)}
            />,
          )}
        </PropertySection>
      </fieldset>
      <PropertySection
        title={t.sections.visibility}
        hasChanges={hidden}
        resetLabel={t.reset}
        onReset={() => dispatch({ type: 'hidden', value: false })}
      >
        <Checkbox
          label={t.controls.hide}
          checked={hidden}
          onChange={(e) => dispatch({ type: 'hidden', value: e.target.checked })}
        />
      </PropertySection>
      <ScopeRow state={state} dispatch={dispatch} onHoverSimilar={onHoverSimilar} />
    </div>
  );
}
