<script setup lang="ts">
import { ref } from 'vue';
import { appState } from '../store';
import { X, Server, Folder, Settings2, ShieldAlert, Keyboard, Palette } from '@lucide/vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'sync'): void,
  (e: 'change-vault'): void,
  (e: 'reset-app'): void,
  (e: 'toggle-auto-sync'): void
}>();

const activeTab = ref('allgemein');

async function toggleAutostart() {
  try {
    const { enable, disable } = await import('@tauri-apps/plugin-autostart');
    if (appState.isAutostartEnabled) {
      await enable();
    } else {
      await disable();
    }
  } catch (e) { console.error("Autostart toggle failed", e); }
}
</script>

<template>
  <div v-if="appState.isSettingsOpen" class="modal-backdrop z-50">
    <!-- Click outside to close -->
    <div class="absolute inset-0" @click="appState.isSettingsOpen = false"></div>
    
    <div class="modal-panel relative z-10 flex w-full max-w-[640px] max-h-[80vh] overflow-hidden p-0">
      
      <!-- Settings Sidebar -->
      <div class="w-48 bg-surface-2 border-r border-divider shrink-0 flex flex-col p-4 space-y-1 overflow-y-auto">
        <h2 class="text-xs font-semibold text-content-tertiary uppercase tracking-wider mb-2 px-2">{{ t('sidebar.settings') }}</h2>
        
        <button 
          @click="activeTab = 'allgemein'"
          :class="['flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors', activeTab === 'allgemein' ? 'bg-white/10 text-content-primary font-medium' : 'text-content-secondary hover:bg-white/5']"
        >
          <Folder class="w-4 h-4" /> {{ t('desktopSettings.generalTitle') }}
        </button>
        
        <button 
          @click="activeTab = 'sync'"
          :class="['flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors', activeTab === 'sync' ? 'bg-white/10 text-content-primary font-medium' : 'text-content-secondary hover:bg-white/5']"
        >
          <Server class="w-4 h-4" /> {{ t('desktopSettings.syncTitle') }}
        </button>
        
        <button 
          @click="activeTab = 'editor'"
          :class="['flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors', activeTab === 'editor' ? 'bg-white/10 text-content-primary font-medium' : 'text-content-secondary hover:bg-white/5']"
        >
          <Settings2 class="w-4 h-4" /> {{ t('settings.editor') }}
        </button>

        <button 
          @click="activeTab = 'appearance'"
          :class="['flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors', activeTab === 'appearance' ? 'bg-white/10 text-content-primary font-medium' : 'text-content-secondary hover:bg-white/5']"
        >
          <Palette class="w-4 h-4" /> {{ t('settings.appearance') }}
        </button>

        <button 
          @click="activeTab = 'shortcuts'"
          :class="['flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors', activeTab === 'shortcuts' ? 'bg-white/10 text-content-primary font-medium' : 'text-content-secondary hover:bg-white/5']"
        >
          <Keyboard class="w-4 h-4" /> {{ t('desktopSettings.shortcutsTitle') }}
        </button>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 flex flex-col overflow-hidden relative">
        <div class="absolute top-4 right-4 z-10">
          <button @click="appState.isSettingsOpen = false" class="p-1 text-content-tertiary hover:text-content-primary transition-colors rounded-md bg-surface-1">
            <X class="w-5 h-5" stroke-width="1.5" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto h-full space-y-8">
          
          <!-- TAB: Allgemein -->
          <div v-if="activeTab === 'allgemein'" class="space-y-8 animate-fade-in">
            <div>
              <h3 class="text-lg font-medium text-content-primary mb-4">{{ t('desktopSettings.generalTitle') }}</h3>
              <div class="space-y-3">
                <div>
                  <label class="block text-xs text-content-tertiary mb-1 uppercase tracking-wide">{{ t('desktopSettings.currentVault') }}</label>
                  <div class="text-[13px] text-content-secondary bg-surface-2 px-3 py-2 rounded border border-divider break-all font-mono">
                    {{ appState.vaultPath || t('desktopSettings.noVaultSelected') }}
                  </div>
                </div>
                <div class="pt-1">
                  <button @click="emit('change-vault')" class="btn-secondary text-[13px]">
                    {{ t('desktopSettings.changeVault') }}
                  </button>
                </div>
                
                <div class="pt-2 pb-2 flex items-center justify-between border-b border-divider">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      v-model="appState.isAutostartEnabled" 
                      @change="toggleAutostart"
                      class="toggle-switch shrink-0"
                    />
                    <div>
                      <div class="text-[13px] text-content-primary font-medium">{{ t('desktopSettings.autostart') }}</div>
                      <div class="text-xs text-content-tertiary">{{ t('desktopSettings.autostartDesc') }}</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Danger Zone -->
            <div class="pt-4 border-t border-divider-strong">
              <h3 class="text-sm font-medium text-danger-DEFAULT flex items-center gap-2 mb-2">
                <ShieldAlert class="w-4 h-4" /> {{ t('desktopSettings.dangerZone') }}
              </h3>
              <p class="text-[13px] text-content-tertiary mb-3">
                {{ t('desktopSettings.resetAppDesc') }}
              </p>
              <button @click="emit('reset-app')" class="btn-secondary text-danger-DEFAULT border-danger-strong hover:bg-danger-DEFAULT/10 text-[13px]">
                {{ t('desktopSettings.resetApp') }}
              </button>
            </div>
          </div>

          <!-- TAB: Sync -->
          <div v-if="activeTab === 'sync'" class="space-y-8 animate-fade-in">
            <div>
              <h3 class="text-lg font-medium text-content-primary mb-4">{{ t('desktopSettings.syncTitle') }}</h3>
              
              <div class="space-y-4">
                <div>
                  <label class="block text-xs text-content-tertiary mb-1 uppercase tracking-wide">{{ t('desktopSettings.serverUrl') }}</label>
                  <input v-model="appState.serverUrl" placeholder="https://..." class="input" />
                </div>
                <div>
                  <label class="block text-xs text-content-tertiary mb-1 uppercase tracking-wide">{{ t('desktopSettings.bearerToken') }}</label>
                  <input v-model="appState.token" type="password" placeholder="eyJhbGci..." class="input" />
                </div>
                
                <div class="pt-2 pb-2 flex items-center justify-between border-b border-divider">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      v-model="appState.isAutoSyncEnabled" 
                      @change="emit('toggle-auto-sync')"
                      class="toggle-switch shrink-0"
                    />
                    <div>
                      <div class="text-[13px] text-content-primary font-medium">{{ t('desktopSettings.autoSync') }}</div>
                      <div class="text-xs text-content-tertiary">{{ t('desktopSettings.autoSyncDesc') }}</div>
                    </div>
                  </label>
                </div>
                
                <div class="pt-3 flex items-center justify-between">
                  <p class="text-xs text-content-tertiary">{{ appState.statusMsg || t('desktopSettings.syncStatusReady') }}</p>
                  <button @click="emit('sync')" class="btn-primary shrink-0">
                    {{ t('desktopSettings.connectAndSync') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB: Appearance -->
          <div v-if="activeTab === 'appearance'" class="space-y-8 animate-fade-in">
            <div>
              <h3 class="text-lg font-medium text-content-primary mb-6">{{ t('settings.appearance') }}</h3>
              
              <div class="space-y-6">
                <!-- Theme -->
                <div>
                  <label class="block text-xs font-semibold text-content-primary mb-2">{{ t('settings.theme') }}</label>
                  <div class="flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-divider w-max">
                    <button 
                      @click="appState.theme = 'dark'"
                      :class="['px-4 py-1.5 rounded-md text-[13px] transition-colors', appState.theme === 'dark' ? 'bg-surface-1 text-content-primary shadow-sm border border-divider' : 'text-content-secondary hover:text-content-primary border border-transparent']"
                    >
                      {{ t('settings.themeDark') }}
                    </button>
                    <button 
                      @click="appState.theme = 'light'"
                      :class="['px-4 py-1.5 rounded-md text-[13px] transition-colors', appState.theme === 'light' ? 'bg-surface-1 text-content-primary shadow-sm border border-divider' : 'text-content-secondary hover:text-content-primary border border-transparent']"
                    >
                      {{ t('settings.themeLight') }}
                    </button>
                  </div>
                </div>

                <!-- Accent Color -->
                <div>
                  <label class="block text-xs font-semibold text-content-primary mb-2">{{ t('settings.accentColor') }}</label>
                  <div class="flex items-center gap-3">
                    <input 
                      type="color" 
                      :value="appState.accentColor || '#F5A623'"
                      @change="(e) => appState.accentColor = (e.target as HTMLInputElement).value"
                      class="h-10 w-20 cursor-pointer rounded border border-divider bg-base p-1"
                    />
                    <button 
                      v-if="appState.accentColor"
                      @click="appState.accentColor = null"
                      class="btn-secondary text-[13px] hover:bg-surface-2"
                    >
                      {{ t('settings.resetAccentColor') }}
                    </button>
                  </div>
                </div>

                <!-- Language -->
                <div>
                  <label class="block text-xs font-semibold text-content-primary mb-2">{{ t('settings.language') }}</label>
                  <select v-model="appState.locale" class="custom-select w-full max-w-[250px] text-[13px] font-medium">
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB: Editor -->
          <div v-if="activeTab === 'editor'" class="space-y-8 animate-fade-in">
            <div>
              <h3 class="text-lg font-medium text-content-primary mb-6">{{ t('desktopSettings.editorTitle') }}</h3>
              
              <div class="space-y-6">
                <!-- Default View -->
                <div>
                  <label class="block text-xs font-semibold text-content-primary mb-2">{{ t('desktopSettings.defaultView') }}</label>
                  <div class="flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-divider w-max">
                    <button 
                      @click="appState.defaultView = 'editor'"
                      :class="['px-4 py-1.5 rounded-md text-[13px] transition-colors', appState.defaultView === 'editor' ? 'bg-surface-1 text-content-primary shadow-sm border border-divider' : 'text-content-secondary hover:text-content-primary border border-transparent']"
                    >
                      {{ t('desktopSettings.viewEditor') }}
                    </button>
                    <button 
                      @click="appState.defaultView = 'reader'"
                      :class="['px-4 py-1.5 rounded-md text-[13px] transition-colors', appState.defaultView === 'reader' ? 'bg-surface-1 text-content-primary shadow-sm border border-divider' : 'text-content-secondary hover:text-content-primary border border-transparent']"
                    >
                      {{ t('desktopSettings.viewReader') }}
                    </button>
                  </div>
                </div>

                <!-- Font Family -->
                <div>
                  <label class="block text-xs font-semibold text-content-primary mb-2">{{ t('desktopSettings.fontFamily') }}</label>
                  <select v-model="appState.editorFontFamily" class="custom-select w-full max-w-[250px] text-[13px] font-medium">
                    <option value="sans">{{ t('desktopSettings.fontSans') }}</option>
                    <option value="serif">{{ t('desktopSettings.fontSerif') }}</option>
                    <option value="mono">{{ t('desktopSettings.fontMono') }}</option>
                  </select>
                </div>

                <!-- Font Size -->
                <div>
                  <label class="block text-xs font-semibold text-content-primary mb-2">{{ t('desktopSettings.fontSize') }}</label>
                  <div class="flex items-center gap-4">
                    <input 
                      type="range" 
                      v-model.number="appState.editorFontSize" 
                      min="12" max="24" step="1"
                      class="custom-slider flex-1 max-w-[250px]"
                    />
                    <span class="text-[13px] text-content-primary font-mono w-8 bg-surface-2 px-2 py-1 rounded text-center border border-divider shadow-inner">{{ appState.editorFontSize }}</span>
                  </div>
                </div>

                <!-- Line Height -->
                <div>
                  <label class="block text-xs font-semibold text-content-primary mb-2">{{ t('desktopSettings.lineHeight') }}</label>
                  <div class="flex items-center gap-4">
                    <input 
                      type="range" 
                      v-model.number="appState.editorLineHeight" 
                      min="1.2" max="2.2" step="0.1"
                      class="custom-slider flex-1 max-w-[250px]"
                    />
                    <span class="text-[13px] text-content-primary font-mono w-8 bg-surface-2 px-2 py-1 rounded text-center border border-divider shadow-inner">{{ appState.editorLineHeight }}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- TAB: Shortcuts -->
          <div v-if="activeTab === 'shortcuts'" class="space-y-6 animate-fade-in">
            <div>
              <h3 class="text-base font-semibold mb-4 text-content-primary">{{ t('desktopSettings.shortcutsTitle') }}</h3>
              <div class="space-y-0.5 border border-divider rounded-lg overflow-hidden bg-surface-1">
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.openCommandPalette') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Cmd/Ctrl</kbd><kbd>K</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.openSearch') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Cmd/Ctrl</kbd><kbd>F</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.createNote') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Cmd/Ctrl</kbd><kbd>Alt</kbd><kbd>N</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.toggleSidebar') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Cmd/Ctrl</kbd><kbd>\</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.saveNote') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Cmd/Ctrl</kbd><kbd>S</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.bold') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Cmd/Ctrl</kbd><kbd>B</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.italic') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Cmd/Ctrl</kbd><kbd>I</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50 border-b border-divider">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.closeDialog') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>Esc</kbd></div>
                </div>
                
                <div class="flex items-center justify-between px-4 py-3 bg-surface-2/50">
                  <span class="text-[13px] text-content-primary">{{ t('desktopSettings.navPalette') }}</span>
                  <div class="flex items-center gap-1.5"><kbd>↑</kbd><kbd>↓</kbd><kbd>Enter</kbd></div>
                </div>
                
              </div>
            </div>
          </div>

        </div>
      </div>
      
    </div>
  </div>
</template>
