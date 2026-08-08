<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Transition enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <!-- Plain dim scrim, no blur - native iOS/Android bottom sheets don't
         blur the backdrop (that's reserved for centered dialogs elsewhere
         in this app), and blurring here visibly smears any accent-colored
         UI behind the sheet (e.g. a favorited note's star in
         DocumentHeader.vue) into a distracting colored bar. -->
    <div v-if="open" class="fixed inset-0 z-50 bg-black/40" @click="emit('close')" />
  </Transition>

  <Transition
    enter-active-class="transition duration-200 ease-out"
    leave-active-class="transition duration-150 ease-in"
    enter-from-class="translate-y-full"
    leave-to-class="translate-y-full"
  >
    <div
      v-if="open"
      role="dialog"
      class="fixed inset-x-0 bottom-0 z-50 flex max-h-dialog flex-col rounded-t-xl border-t border-border-strong bg-surface-1 pb-safe-b text-content-primary shadow-float"
      @click.stop
    >
      <div class="flex shrink-0 justify-center pt-2 pb-1">
        <span class="h-1 w-10 rounded-full bg-white/15" />
      </div>
      <div class="min-h-0 overflow-y-auto">
        <slot />
      </div>
    </div>
  </Transition>
</template>
