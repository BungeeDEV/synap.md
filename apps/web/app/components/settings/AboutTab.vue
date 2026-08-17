<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const config = useRuntimeConfig()
</script>

<template>
  <div>
    <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">{{ t('settings.aboutTitle') }}</h2>
    <p class="text-2xl font-semibold text-content-primary">{{ t('settings.appName') }}</p>
    <p class="mt-1 font-mono text-sm text-content-tertiary">
      Version {{ config.public.appVersion }}
    </p>

    <!-- TODO: Repo-Link ergänzen, sobald das Projekt öffentlich verfügbar ist. -->
  </div>
</template>
