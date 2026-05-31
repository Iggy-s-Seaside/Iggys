import type { Party } from '../types';

export interface PartyPreset {
  id: string;
  label: string;
  emoji: string;
  /** Sensible field defaults pre-filled when this type is chosen, so the owner only edits what differs. */
  defaults: Partial<Party>;
}

const UPSTAIRS = 'Upstairs satellite bar';

/**
 * Smart defaults for common party types. Picking one during Quick-Add pre-fills
 * space / room rate / hours / gratuity / food service so most fields are already right.
 */
export const PARTY_PRESETS: PartyPreset[] = [
  {
    id: 'birthday',
    label: 'Birthday',
    emoji: '🎂',
    defaults: { space_name: UPSTAIRS, room_rate: 200, room_hours: 2, gratuity_rate: 0.18, food_service_type: 'Order as you go' },
  },
  {
    id: 'corporate',
    label: 'Corporate',
    emoji: '💼',
    defaults: { space_name: UPSTAIRS, room_rate: 200, room_hours: 3, gratuity_rate: 0.18, food_service_type: 'Appetizers on arrival' },
  },
  {
    id: 'celebration_of_life',
    label: 'Celebration of life',
    emoji: '🕊️',
    defaults: { space_name: UPSTAIRS, room_rate: 200, room_hours: 3, gratuity_rate: 0.18, food_service_type: 'Buffet' },
  },
  {
    id: 'holiday',
    label: 'Holiday party',
    emoji: '🎉',
    defaults: { space_name: UPSTAIRS, room_rate: 200, room_hours: 3, gratuity_rate: 0.18, food_service_type: 'Buffet' },
  },
  {
    id: 'custom',
    label: 'Custom',
    emoji: '✨',
    defaults: {},
  },
];

export const DEFAULT_PRESET_ID = 'custom';
