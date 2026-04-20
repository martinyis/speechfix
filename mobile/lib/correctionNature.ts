import type { Ionicons } from '@expo/vector-icons';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type NatureKey =
  | 'missing'
  | 'order'
  | 'tense'
  | 'pairing'
  | 'register'
  | 'repeated'
  | 'wrong_word'
  | 'number'
  | 'other';

export interface CorrectionNature {
  natureKey: NatureKey;
  /** Short display label, sentence case, glanceable. */
  label: string;
  /** Ionicon name. */
  icon: IoniconName;
}

/**
 * Map a raw correction_type string (from the backend) to a human "nature" —
 * a small set of buckets the UI can show as an icon + short label.
 *
 * The mapping collapses 13 correction types into 8 natures so the icon vocabulary
 * stays small and glanceable.
 */
export function getCorrectionNature(correctionType: string): CorrectionNature {
  switch (correctionType) {
    case 'article':
    case 'missing_word':
    case 'preposition':
      return { natureKey: 'missing', label: 'Missing word', icon: 'add-circle-outline' };

    case 'word_order':
    case 'sentence_structure':
      return { natureKey: 'order', label: 'Wrong order', icon: 'swap-horizontal' };

    case 'verb_tense':
      return { natureKey: 'tense', label: 'Wrong tense', icon: 'time-outline' };

    case 'collocation':
      return { natureKey: 'pairing', label: 'Wrong pairing', icon: 'link-outline' };

    case 'register':
    case 'naturalness':
      return { natureKey: 'register', label: 'Sounds off', icon: 'chatbubble-outline' };

    case 'redundancy':
    case 'other':
      return { natureKey: 'repeated', label: 'Repeated or stumbled', icon: 'refresh-outline' };

    case 'word_choice':
      return { natureKey: 'wrong_word', label: 'Wrong word', icon: 'alert-circle-outline' };

    case 'plural_singular':
    case 'subject_verb_agreement':
      return { natureKey: 'number', label: 'Number disagrees', icon: 'git-compare-outline' };

    default:
      return { natureKey: 'other', label: 'Needs a tweak', icon: 'sparkles-outline' };
  }
}

/**
 * Extract a short ~6-word headline from an LLM-generated explanation.
 *
 * Strategy: take the first clause before the first punctuation boundary
 * (., —, :, ;, ,), strip trailing punctuation, cap at 6 words. Returns null
 * if nothing useful can be extracted.
 */
export function extractShortReason(explanation: string | null | undefined): string | null {
  if (!explanation) return null;
  const trimmed = explanation.trim();
  if (!trimmed) return null;

  // Split on the first sentence boundary or em dash. We use a regex that
  // matches the first occurrence of any of: . — – : ; ,
  const match = trimmed.match(/^([^.\u2014\u2013:;,]+)/);
  let head = (match ? match[1] : trimmed).trim();

  // Strip any residual trailing punctuation / quote marks.
  head = head.replace(/["'`]+$/, '').replace(/[\s.\-–—:;,]+$/, '').trim();
  if (!head) return null;

  // Cap at 6 words.
  const words = head.split(/\s+/);
  if (words.length <= 6) return head;
  return words.slice(0, 6).join(' ') + '…';
}

// Re-export the icon name type for consumers.
export type { IoniconName };
