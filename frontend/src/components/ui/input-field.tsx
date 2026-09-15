/**
 * Re-export of the input primitives.
 *
 * `inputs.tsx` (plural) holds the full family: Input, SearchInput, Select,
 * Textarea, Checkbox, Switch, FilterBar and SegmentedFilter. This module exists
 * so components can import from a predictable `input-field` path.
 */
export {
  Input,
  SearchInput,
  Select,
  Textarea,
  Checkbox,
  Switch,
  FilterBar,
  FilterChip,
  SegmentedFilter,
} from './inputs'
export type { InputProps, SelectProps } from './inputs'
