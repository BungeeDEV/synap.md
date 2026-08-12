import sharedConfig from '@synap/config-tailwind'
import type { Config } from 'tailwindcss'

export default {
  ...sharedConfig,
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    '../../packages/ui-vue/src/**/*.{vue,ts}'
  ]
} satisfies Config
