<template>
  <div class="flex h-screen w-full items-center justify-center flex-col gap-4 text-center p-8">
    <h1 class="text-4xl font-bold">404</h1>
    <p class="text-muted-foreground text-lg">
      {{ t('notFound.message') }}
    </p>
    <button
      class="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md inline-flex items-center justify-center font-medium transition-colors"
      @click="router.push('/')"
    >
      {{ t('notFound.backHome') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
</script>
