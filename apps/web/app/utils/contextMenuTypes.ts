import type { Component } from 'vue'

interface ContextMenuItemBase {
  id: string
  label: string
  icon: Component
  danger?: boolean
  disabled?: boolean
}

export interface ContextMenuActionItem extends ContextMenuItemBase {
  onSelect: () => void
  submenu?: undefined
}

/** Renders `slot[submenu]` in a flyout panel instead of calling an action directly - see ContextMenu.vue. */
export interface ContextMenuSubmenuItem extends ContextMenuItemBase {
  onSelect?: undefined
  submenu: string
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSubmenuItem

/** One array = one visually separated group, rendered with a divider between groups. */
export type ContextMenuGroup = ContextMenuItem[]

/** Shared by ContextMenu.vue and ContextMenuItem.vue - single source of truth for the action-vs-submenu discriminant. */
export function isSubmenuItem(item: ContextMenuItem): item is ContextMenuSubmenuItem {
  return 'submenu' in item && typeof item.submenu === 'string'
}
