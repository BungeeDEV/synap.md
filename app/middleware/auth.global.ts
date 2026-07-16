export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login' || to.path === '/setup') return

  const { loggedIn } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
