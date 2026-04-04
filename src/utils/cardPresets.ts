/** Card presets - dimensions in inches */
export interface CardPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  description: string;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'business',
    label: 'Business Card',
    width: 3.5,
    height: 2,
    description: '3.5 × 2 in (US standard)',
  },
  {
    id: 'credit',
    label: 'Credit Card (CR80)',
    width: 3.375,
    height: 2.125,
    description: '3⅜ × 2⅛ in (ISO 7810)',
  },
  {
    id: 'bookmark',
    label: 'Bookmark',
    width: 2,
    height: 7,
    description: '2 × 7 in',
  },
  {
    id: 'postcard',
    label: 'Postcard / Queue Card',
    width: 4,
    height: 6,
    description: '4 × 6 in (US postcard)',
  },
  {
    id: 'index3x5',
    label: 'Index Card 3×5',
    width: 5,
    height: 3,
    description: '5 × 3 in',
  },
  {
    id: 'index4x6',
    label: 'Index Card 4×6',
    width: 6,
    height: 4,
    description: '6 × 4 in',
  },
  {
    id: 'loyalty',
    label: 'Loyalty / Gift Card',
    width: 3.375,
    height: 2.125,
    description: '3⅜ × 2⅛ in (CR80)',
  },
  {
    id: 'flyer_quarter',
    label: 'Quarter-Sheet Flyer',
    width: 4.25,
    height: 5.5,
    description: '4.25 × 5.5 in',
  },
  {
    id: 'custom',
    label: 'Custom',
    width: 3.5,
    height: 2,
    description: 'Enter your own dimensions',
  },
];
