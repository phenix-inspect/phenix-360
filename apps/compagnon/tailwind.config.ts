import type { Config } from 'tailwindcss';
import preset from '@phenix360/ui/tailwind-preset';

// Le thème vient ENTIÈREMENT du preset @phenix360/ui (tokens). On déclare juste
// le contenu à scanner — y compris les composants du Design System.
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config;
