import type { Component } from 'vue';

export interface ContextMenuItemBase {
  id: string;
  label: string;
  icon?: Component;
  danger?: boolean;
  disabled?: boolean;
}

// Action-Item: führt direkt eine Funktion aus
export interface ContextMenuActionItem extends ContextMenuItemBase {
  onSelect: () => void;
  submenu?: undefined;
}

// Submenu-Item: öffnet ein Flyout-Panel statt einer Aktion
export interface ContextMenuSubmenuItem extends ContextMenuItemBase {
  onSelect?: undefined;
  submenu: string; // Name des Slots/Panels, das gerendert wird
}

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSubmenuItem;
export type ContextMenuGroup = ContextMenuItem[]; // eine Gruppe = ein durch Divider getrennter Block

// Type-Guard
export function isSubmenuItem(item: ContextMenuItem): item is ContextMenuSubmenuItem {
  return 'submenu' in item && typeof item.submenu === 'string';
}
