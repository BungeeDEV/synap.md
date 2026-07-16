<script setup lang="ts">
const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pb-safe-b">
    <button
      v-for="toast in toasts"
      :key="toast.id"
      type="button"
      class="pointer-events-auto rounded-full border border-border-strong bg-surface-1 px-4 py-2 text-sm shadow-float transition-colors duration-150"
      :class="toast.variant === 'error' ? 'text-danger' : 'text-content-primary'"
      @click="dismiss(toast.id)"
    >
      {{ toast.message }}
    </button>
  </div>
</template>
