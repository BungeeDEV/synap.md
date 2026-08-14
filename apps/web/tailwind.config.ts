import sharedConfig from '@synap/config-tailwind'
import type { Config } from 'tailwindcss'

export default {
  ...sharedConfig,
  content: [
    './app/**/*.{vue,ts}',
    '../../packages/ui-vue/src/**/*.{vue,ts}'
  ]
} satisfies Config
