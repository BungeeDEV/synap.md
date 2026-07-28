<script setup lang="ts">
const { toasts, dismiss } = useToast()
</script>

<template>
  <TransitionGroup
    tag="div"
    class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pb-safe-b"
    enter-active-class="transition duration-150 ease-out"
    leave-active-class="transition duration-150 ease-in absolute"
    enter-from-class="translate-y-2 opacity-0"
    leave-to-class="translate-y-2 opacity-0"
    move-class="transition-transform duration-150 ease-out"
  >
    <button
      v-for="toast in toasts"
      :key="toast.id"
      type="button"
      class="pointer-events-auto rounded-full border border-border-strong bg-surface-1 px-5 py-2.5 text-base shadow-float transition-colors duration-150"
      :class="toast.variant === 'error' ? 'text-danger' : 'text-content-primary'"
      @click="dismiss(toast.id)"
    >
      {{ toast.message }}
    </button>
  </TransitionGroup>
</template>
