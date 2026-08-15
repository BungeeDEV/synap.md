<template>
  <div class="flex h-screen w-full items-center justify-center flex-col gap-4 text-center p-8">
    <h1 class="text-4xl font-bold">404</h1>
    <p class="text-muted-foreground text-lg">
      Die gesuchte Seite wurde leider nicht gefunden.
    </p>
    <button
      class="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md inline-flex items-center justify-center font-medium transition-colors"
      @click="router.push('/')"
    >
      Zurück zur Startseite
    </button>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
</script>
