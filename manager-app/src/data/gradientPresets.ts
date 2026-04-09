export interface GradientPreset {
  id: string;
  name: string;
  gradient: string;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'ocean',
    name: 'Ocean',
    gradient: 'linear-gradient(180deg, #060d1a 0%, #0a2040 30%, #1a5070 50%, #0a2040 70%, #060d1a 100%)',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    gradient: 'linear-gradient(180deg, #0a0e1a 0%, #3d1a3a 30%, #c4582a 55%, #f5b84a 75%, #0a0e1a 100%)',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    gradient: 'linear-gradient(180deg, #000000 0%, #0a1628 50%, #000000 100%)',
  },
  {
    id: 'ember',
    name: 'Ember',
    gradient: 'linear-gradient(180deg, #1a0a0a 0%, #4a1010 40%, #7a2020 60%, #1a0a0a 100%)',
  },
  {
    id: 'storm',
    name: 'Storm',
    gradient: 'linear-gradient(180deg, #0f1115 0%, #1e2530 35%, #2a3545 50%, #1e2530 65%, #0f1115 100%)',
  },
  {
    id: 'neon',
    name: 'Neon',
    gradient: 'linear-gradient(180deg, #0a0020 0%, #1a0040 30%, #2dd4bf 52%, #1a0040 70%, #0a0020 100%)',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    gradient: 'linear-gradient(180deg, #0a1628 0%, #1a3050 30%, #d97706 55%, #f59e0b 70%, #0a1628 100%)',
  },
  {
    id: 'clean-dark',
    name: 'Clean Dark',
    gradient: 'linear-gradient(180deg, #0a0f0f 0%, #1a1a2e 50%, #0a0f0f 100%)',
  },
  {
    id: 'coastal',
    name: 'Coastal',
    gradient: 'linear-gradient(180deg, #0a0f0f 0%, #0d2626 30%, #2dd4bf 50%, #0d2626 70%, #0a0f0f 100%)',
  },
  {
    id: 'rose',
    name: 'Rose',
    gradient: 'linear-gradient(180deg, #1a0a15 0%, #4a1535 35%, #ec4899 55%, #4a1535 75%, #1a0a15 100%)',
  },
];
