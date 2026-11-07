import { forwardRef } from 'react';
import type { Intent, NoteTag } from '../../domain';
import { copy } from '../../copy';
import { Chip, Icon, IconButton, Input, Kbd, icons } from '../../ui';
import type { Filters } from '../model';
import { usePanel } from './context';
import { searchHint } from './hooks';

const t = copy.panel.search;
const TYPES: readonly NoteTag[] = ['text', 'style', 'hide', 'comment'];
const INTENTS: readonly Intent[] = ['apply', 'propose'];

export interface SearchBarProps {
  readonly search: string;
  readonly filters: Filters;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { search, filters },
  ref,
) {
  const { actions } = usePanel();
  return (
    <div className="fvp-search" role="search">
      <div className="fvp-search__field">
        <Icon icon={icons.search} className="fvp-search__icon" />
        <Input
          ref={ref}
          aria-label={t.placeholder}
          placeholder={t.placeholder}
          value={search}
          onChange={(e) => void actions.setSearch(e.target.value)}
          className="fvp-search__input"
        />
        {search === '' ? (
          <Kbd>{searchHint(t.hint)}</Kbd>
        ) : (
          <IconButton
            label={t.clearLabel}
            icon={icons.close}
            className="fv-iconbtn--xs"
            onClick={() => void actions.setSearch('')}
          />
        )}
      </div>
      <div className="fvp-search__chips">
        {TYPES.map((tag) => (
          <Chip key={tag} pressed={filters.types.has(tag)} onPressedChange={() => void actions.toggleType(tag)}>
            {t.chips[tag]}
          </Chip>
        ))}
        <span className="fvp-search__sep" aria-hidden="true" />
        {INTENTS.map((intent) => (
          <Chip
            key={intent}
            pressed={filters.intents.has(intent)}
            onPressedChange={() => void actions.toggleIntent(intent)}
          >
            {t.chips[intent]}
          </Chip>
        ))}
        <span className="fvp-search__sep" aria-hidden="true" />
        <Chip pressed={filters.notFound} onPressedChange={() => void actions.toggleNotFound()}>
          {t.chips.notFound}
        </Chip>
      </div>
    </div>
  );
});
