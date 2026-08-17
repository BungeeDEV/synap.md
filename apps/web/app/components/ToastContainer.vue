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
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex cursor-pointer items-center gap-3 rounded-full border border-border-strong bg-surface-1 py-2.5 pr-2.5 pl-5 text-base shadow-float transition-colors duration-150"
      :class="toast.variant === 'error' ? 'text-danger' : 'text-content-primary'"
      @click="dismiss(toast.id)"
    >
      {{ toast.message }}<span v-if="toast.count > 1" class="text-content-tertiary"> ({{ toast.count }}×)</span>
      <button
        v-if="toast.action"
        type="button"
        class="shrink-0 rounded-full bg-white/[0.06] px-3 py-1 text-sm font-medium text-content-primary transition-colors duration-150 hover:bg-white/[0.1]"
        @click.stop="toast.action.onClick(); dismiss(toast.id)"
      >
        {{ toast.action.label }}
      </button>
    </div>
  </TransitionGroup>
</template>
