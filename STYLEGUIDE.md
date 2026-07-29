# Styleguide – Quiet Dark Editor

Referenz-Dokument für den Design-Refactor der Notes-App. Ziel: ruhige,
fast-schwarze Editor-Optik im Stil nativer Desktop-Apps (Obsidian, Bear,
iA Writer). Tiefe entsteht über Flächen + hauchdünne Borders, **nicht** über
Schatten oder Neumorphism.

## Grundprinzipien

- Borders statt Shadows als primäres Trennmittel zwischen Flächen
- Zurückhaltende Radien (8-12px), keine 32px-Extreme
- Ein einziger Akzentton (gedämpftes Violett), Grün nur für Saved-Status,
  Rot nur für Fehler/Konflikte
- Keine Touch/Mobile-Tactile-Patterns (`active:scale-95` etc.) - das ist ein
  Desktop/Web-Editor

---

## 1. Tailwind-Only Enforcement (zwingend, keine Ausnahmen)

Es wird ausschließlich mit Tailwind-Utility-Classes gearbeitet. Kein Fallback
auf klassisches CSS, egal in welcher Form.

**Verboten:**
- `<style>`-Blöcke in Vue-SFCs, auch nicht `scoped`
- Inline `style="..."`-Attribute
- Neue/eigene `.css`-Dateien (außer der einen globalen Tailwind-Entry-Datei)
- "Random" Arbitrary-Values direkt in Komponenten, z.B. `bg-[#2a2a2a]`,
  `text-[15px]`, `mt-[13px]` - jeder Wert, der nicht Teil der Config ist, ist
  verboten

**Pflicht:**
- Jeder Farbwert, jede Radius-Stufe, jeder Spacing-Wert, der nicht aus
  Tailwinds Default-Scale kommt, wird **zuerst** als benannter Token in
  `tailwind.config.ts` (`theme.extend`) definiert und danach ausschließlich
  über die semantische Klasse verwendet (`bg-surface-1` statt `bg-[#1a1a1a]`)
- Arbitrary-Value-Syntax (`[...]`) ist ausschließlich innerhalb von
  `tailwind.config.ts` erlaubt (dort werden die Hex-/Px-Werte einmalig
  definiert) - niemals verstreut in einzelnen Komponenten
- Taucht beim Refactor ein Wert auf, der im Styleguide fehlt (z.B. eine neue
  Spacing-Stufe): zuerst in die Config aufnehmen, danach erst in der
  Komponente verwenden. Nie andersrum.
- Icon-Größen, Border-Radien, Farben, Spacing, Font-Sizes - ausnahmslos über
  Tailwind-Klassen, die auf Config-Tokens verweisen

Ziel: jede Design-Entscheidung ist an genau einer Stelle
(`tailwind.config.ts`) nachvollziehbar und wird nicht in 30 Komponenten
unterschiedlich neu erfunden.

---

## 2. Design-Tokens (Tailwind-Config)

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        base: '#141414',
        surface: {
          1: '#1a1a1a',
          2: '#232323',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.05)',
          strong: 'rgba(255,255,255,0.10)',
        },
        content: {
          primary: '#EDEDEC',
          secondary: '#a3a3a3',
          tertiary: '#737373',
        },
        accent: {
          DEFAULT: '#8B7FE0',
          soft: 'rgba(139,127,224,0.5)',
        },
        success: '#4ADE80',
        danger: '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
}
```

### Farb-Tokens

| Token | Tailwind-Klasse | Wert (approx.) | Verwendung |
|---|---|---|---|
| Base | `bg-base` | `#141414` | App-Hintergrund |
| Surface 1 | `bg-surface-1` | `#1a1a1a` | Sidebar, Statusbar, Panels |
| Surface 2 | `bg-surface-2` | `#232323` | Hover/Active/Selected Rows |
| Border | `border-border` | `white/5` | Standard-Trennlinie |
| Border Strong | `border-border-strong` | `white/10` | Modal-/Panel-Rahmen |
| Text Primary | `text-content-primary` | `#EDEDEC` | Haupttext |
| Text Secondary | `text-content-secondary` | `#a3a3a3` | Fließtext gedämpft |
| Text Tertiary | `text-content-tertiary` | `#737373` | Meta/Labels |
| Accent | `text-accent` / `bg-accent` | `#8B7FE0` | Links, Fokus, aktive Icons |
| Success | `text-success` / `bg-success` | `#4ADE80` | Saved-Status-Dot |
| Danger | `text-danger` | `#F87171` | Fehler/Konflikte |

**Verboten:** reines `#000000` als Hintergrund, harte weiße Borders, große
grüne/rote Flächen (nur als kleine Akzente/Dots verwenden), und - siehe
Abschnitt 1 - jeder dieser Werte direkt als Arbitrary-Value in einer
Komponente statt über die Token-Klasse.

---

## 3. Typografie

| Element | Klassen | Verwendung |
|---|---|---|
| Dokument-Titel (H1) | `text-4xl md:text-5xl font-bold tracking-tight text-content-primary` | Editor-Dokumenttitel |
| Section-Heading (H2) | `text-xl font-semibold border-b border-border pb-2` | Abschnittsüberschriften im Content |
| Body | `text-base leading-relaxed text-content-secondary` | Fließtext |
| Meta/Label | `text-xs uppercase tracking-wider text-content-tertiary font-medium` | Sidebar-Labels, Statusbar-Werte |
| Code/Mono | `font-mono text-sm` | Inline-Code, Shortcuts, Statistiken |

Font-Stack: Inter/System-UI für UI-Text, JetBrains Mono (oder
`ui-monospace`-Fallback) für alles Code-artige - beides über
`fontFamily.sans`/`fontFamily.mono` in der Config, nie per Inline-Font-Import
in einer Komponente.

---

## 4. Radius & Spacing

| Kontext | Wert |
|---|---|
| Panels/Cards | `rounded-lg` (8px) bis `rounded-xl` (12px) |
| Pills/Badges/Toggle-Buttons | `rounded-full` |
| Editor-Content-Breite | `max-w-3xl` (~680-760px) |
| Sidebar-Breite | `w-64` (256px) |
| Statusbar-Höhe | `h-8` bis `h-10` |
| Vertikaler Rhythmus | `space-y-6` bis `space-y-8` zwischen Content-Blöcken |

Shadows nur bei schwebenden Elementen (Command Palette, Modals,
Conflict-Dialog), immer kombiniert mit Backdrop-Blur. Auch dieser Shadow-Wert
gehört als benannter Token in die Config (z.B. `boxShadow.float`), nicht als
Arbitrary-Value in der Komponente:

```ts
// tailwind.config.ts, theme.extend
boxShadow: {
  float: '0 20px 60px rgba(0,0,0,0.5)',
},
```
Verwendung dann: `shadow-float backdrop-blur-md`

---

## 5. Component-Recipes

Fertige Klassen-Kombinationen zum direkten Einsetzen beim Refactor - alle
ausschließlich aus Tailwind-Klassen, die auf die Tokens aus Abschnitt 2
verweisen.

**Sidebar - aktiver Eintrag**
```
bg-surface-2 rounded-md px-2 py-1.5 text-content-primary font-medium
```

**Sidebar - System-Eintrag (Papierkorb/Vorlagen, außerhalb des Vault-Baums)**
```
flex items-center gap-2 rounded-md px-2.5 py-2 text-content-secondary
hover:bg-white/[0.04] hover:text-content-primary transition-colors duration-150
```
Gleiche Zeilen-Optik wie normale Tree-Einträge, aber als feste Zeilen außerhalb
von `VaultTree.vue` gerendert (nicht Teil des rekursiven Baums) - siehe
components.md für die Begründung (Trash/Templates sind keine Vault-Tree-Knoten).

**Sidebar - Favoriten-Stern**
```
text-content-tertiary hover:text-accent   /* unfavorisiert */
text-accent                                /* favorisiert, fill="currentColor" */
```

**Sidebar - Hover**
```
hover:bg-white/[0.04] transition-colors duration-150 rounded-md
```

**View-Toggle Pill (Quelltext/Magic View/Split/Vorschau) - aktiv**
```
bg-accent rounded-full text-white
```
Volltonige Akzentfläche statt `bg-surface-2` - der Modus-Umschalter ist ein
Segmented Control, dessen Aktiv-Zustand auf den ersten Blick eindeutig sein
muss (gleiche Kontrast-Logik wie "Slash-Menu - aktive Zeile").

**View-Toggle Pill - inaktiv**
```
text-content-tertiary hover:text-content-secondary
```

**Statusbar**
```
h-9 border-t border-border flex items-center justify-between px-3
text-xs text-content-tertiary
```

**Inline-Code / Shortcut-Badge**
```
bg-white/[0.06] rounded px-1.5 py-0.5 font-mono text-sm text-content-primary
```

**Tabelle - Header**
```
text-content-tertiary text-xs uppercase border-b border-border
```

**Tabelle - Zeile**
```
border-b border-border last:border-0
```

**Checkbox - unchecked**
```
border border-white/20 rounded w-4 h-4
```

**Checkbox - checked**
```
bg-accent rounded w-4 h-4 flex items-center justify-center (+ Check-Icon weiß)
```

**Callout/Blockquote**
```
border-l-2 border-accent/60 bg-white/[0.02] italic text-content-secondary
px-4 py-2
```

**Command Palette - Backdrop**
```
fixed inset-0 backdrop-blur-md bg-black/40
```

**Command Palette - Panel**
```
bg-surface-1 rounded-xl border border-border-strong shadow-float
```

**Command Palette - aktive Zeile**
```
bg-surface-2 rounded-md
```

**Command Palette - Shortcut rechtsbündig**
```
text-content-tertiary font-mono text-xs
```

**Slash-Menu - Gruppen-Header**
```
text-xs uppercase tracking-wider text-content-tertiary font-medium px-3.5 pt-2 pb-1
```
Trennlinie zwischen Gruppen: `border-t border-border` auf dem ersten Eintrag
der Folgegruppe (kein extra `<hr>`-Element).

**Slash-Menu - aktive Zeile**
```
bg-accent rounded-md text-white
```
Bewusste Abweichung von "Command Palette - aktive Zeile" (`bg-surface-2`):
volltonige Hervorhebung wie beim aktiven View-Toggle-Pill, weil das Slash-Menü
tastaturgetrieben ist und die aktive Zeile auf einen Blick erkennbar sein soll.

**Slash-Menu - Shortcut-Hint**
```
text-content-tertiary font-mono text-xs   /* inaktive Zeile */
text-white/70 font-mono text-xs            /* aktive Zeile, auf bg-accent */
```

**Slash-Menu - Footer-Hinweis**
```
border-t border-border px-3.5 py-2 text-xs text-content-tertiary
```

**Modal (z.B. Conflict-Dialog)**
```
bg-surface-1 rounded-xl border border-border-strong p-6
```

**Toast**
```
bg-surface-1 border border-border-strong rounded-full px-4 py-2 text-sm
```

**Fokus-Ring (Inputs, Buttons)**
```
focus:ring-1 focus:ring-accent/50 focus:outline-none
```

**Skeleton/Loading**
```
bg-white/5 rounded animate-pulse
```

**Dokument-Meta-Zeile** (z.B. "zuletzt bearbeitet vor 2 Stunden")
```
text-sm text-content-tertiary
```
Bewusst *nicht* die Meta/Label-Klasse (die ist für Sidebar-Sektionslabels wie
"COLLECTIONS" mit `uppercase tracking-wider` reserviert) - eine Metazeile
unter einem Dokumenttitel liest sich in Groß-/Kleinschreibung natürlicher.

**Breadcrumb** (Vault-Pfad über dem Dokument)
```
flex items-center gap-1 text-sm text-content-tertiary
```
Segmente durch ein kleines `ChevronRight`-Icon (`h-3.5 w-3.5`) getrennt, das
letzte Segment (Dateiname) in `text-content-secondary` statt `-tertiary`.

**TOC-Zeile** (Sprungmarken-Spalte)
```
text-content-tertiary hover:text-content-secondary   /* inaktiv */
text-accent font-medium                               /* aktiv (Scroll-Spy) */
```

**Empty State**
```
Icon: text-content-tertiary, Text darunter: text-content-tertiary text-sm,
zentriert
```

---

## 6. Icons

- Ausschließlich `lucide-vue-next`, Outline-Style
- Strichstärke 1.5-1.75, keine gefüllten Icons außer bei aktiven/selektierten
  Zuständen (z.B. aktiver View-Toggle)
- Icon-Größen über Tailwinds Standard-Size-Klassen (`w-4 h-4`, `w-5 h-5`),
  keine Arbitrary-Pixel-Werte

---

## 7. Interaktion & Motion

- Standard-Übergang: `transition-colors duration-150`
- Kein `active:scale-95` oder ähnliche Touch-Tactile-Effekte
- Fokus-States immer über `accent/50`-Ring, nie dicke/knallige Ringe

---

## 8. Do / Don't

| Do | Don't |
|---|---|
| Borders (`white/5`-`white/10`) zur Flächentrennung | Große weiche Drop-Shadows auf jeder Card |
| `rounded-lg`/`rounded-xl` für Panels | `rounded-[32px]`-Extreme |
| Ein Akzentton (Violett), sparsam eingesetzt | Mehrere bunte Akzentfarben gleichzeitig |
| Grün nur als kleiner Saved-Status-Dot | Grün als große Flächenfarbe |
| Backdrop-Blur nur bei Modals/Command Palette | Backdrop-Blur überall als Deko |
| `transition-colors` für Hover/Active | `scale-95`-Tap-Feedback wie bei Mobile-Apps |
| Werte aus `tailwind.config.ts` referenzieren | Arbitrary-Values (`bg-[#...]`) in Komponenten |
| Alles über Klassen im Template lösen | `<style>`-Blöcke oder `style="..."` |

---

## 9. Refactor-Checkliste

- [ ] `tailwind.config.ts` um alle Tokens aus Abschnitt 2 erweitern
      (inkl. `boxShadow.float`)
- [ ] Alle rohen `neutral-800/900/950`-Werte durch `surface-*`/`base`-Tokens ersetzen
- [ ] Alle `text-gray-*`/`text-neutral-*` durch `content-primary/secondary/tertiary` ersetzen
- [ ] Codebase nach `style=` und `<style` durchsuchen - alle Treffer entfernen/migrieren
- [ ] Codebase nach `bg-[`, `text-[`, `border-[` (Arbitrary-Values) durchsuchen -
      alle Treffer entweder auf Token-Klasse ummünzen oder den fehlenden
      Token in die Config aufnehmen
- [ ] Radien gegen Abschnitt 4 prüfen, Ausreißer korrigieren
- [ ] Alle Drop-Shadows außerhalb von Modal/Command-Palette entfernen
- [ ] Icon-Set komplett auf `lucide-vue-next` Outline vereinheitlichen
- [ ] Fokus-Ringe app-weit auf `accent/50` vereinheitlichen
- [ ] Grün/Rot nur an den in diesem Dokument definierten Stellen prüfen
