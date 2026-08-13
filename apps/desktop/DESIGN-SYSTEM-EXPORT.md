# synap.md — Design System Reference (für Tauri-Portierung)

Dieses Dokument beschreibt das komplette visuelle Designsystem der Web-App
**synap.md** (Nuxt + Tailwind v4), extrahiert aus dem echten Code
(`tailwind.config.ts`, `shared/design-tokens.ts`, `app/assets/css/main.css`,
`STYLEGUIDE.md` sowie realen Komponenten). Ziel: eine Tauri-App (oder jedes
andere Frontend) soll optisch **1:1** wirken wie diese App — gleiche Farben,
gleiche Abstände, gleiche Radien, gleiche Motion.

Referenzstil: **"Quiet Dark Editor"** — ruhige, fast-schwarze Editor-Optik im
Stil nativer Desktop-Apps (Obsidian, Bear, iA Writer). Tiefe entsteht über
**Flächen + hauchdünne Borders**, NICHT über Schatten oder Neumorphism.

---

## 0. Grundprinzipien (zuerst lesen)

1. **Borders statt Shadows** als primäres Trennmittel zwischen Flächen.
   Schatten nur bei schwebenden Elementen (Modals, Command Palette, Toasts),
   immer kombiniert mit Backdrop-Blur.
2. **Zurückhaltende Radien** (8–12px). Keine 24px+/32px-Extreme.
3. **Ein einziger Akzentton**, sparsam eingesetzt. Grün nur für
   Saved/Success-Status, Rot nur für Fehler/Konflikte/destruktive Aktionen.
   Niemals mehrere bunte Akzentfarben gleichzeitig.
4. **Kein `<style>`/Inline-CSS/Arbitrary-Values-Wildwuchs** — jeder Farbwert,
   jede Radius-Stufe, jeder Spacing-Wert ist ein benannter Token, an **einer**
   zentralen Stelle definiert, danach überall nur über den Token referenziert.
5. **Kein Touch/Mobile-Tactile-Feedback** (`active:scale-95` o.ä.) — das ist
   ein Desktop-Editor, kein mobiles Sheet.
6. Fokus-States immer über einen dünnen `accent/50`-Ring, nie dicke/knallige
   Ringe.

---

## 1. Farb-Tokens

> **Hinweis:** Das ältere `STYLEGUIDE.md`-Dokument im Repo nennt noch einen
> violetten Akzent (`#8B7FE0`). Der tatsächliche, aktuell im Code aktive
> Akzentton (`shared/design-tokens.ts`, Single Source of Truth) ist ein
> **warmes Amber/Orange**. Die Tabelle unten spiegelt den aktuellen Stand.

```css
:root {
  /* Flächen */
  --color-base: #141414;        /* App-Hintergrund */
  --color-surface-1: #1a1a1a;   /* Sidebar, Statusbar, Panels, Modals */
  --color-surface-2: #232323;   /* Hover/Active/Selected Rows */

  /* Borders */
  --color-border: rgba(255, 255, 255, 0.05);        /* Standard-Trennlinie */
  --color-border-strong: rgba(255, 255, 255, 0.10);  /* Modal-/Panel-Rahmen */

  /* Text */
  --color-content-primary: #EDEDEC;   /* Haupttext, Überschriften */
  --color-content-secondary: #a3a3a3; /* Fließtext gedämpft */
  --color-content-tertiary: #737373;  /* Meta/Labels/Platzhalter */

  /* Akzent (warmes Amber) */
  --color-accent: #F5A623;
  --color-accent-soft: rgba(245, 166, 35, 0.5);
  --color-accent-strong: #D97706; /* solide Fläche + weißer Text/Icon, ~7:1 Kontrast */

  /* Status */
  --color-success: #4ADE80;
  --color-success-strong: #15803D; /* solide Fläche, ~5:1 Kontrast */
  --color-danger: #F87171;
  --color-danger-strong: #DC2626;  /* solide Fläche, ~4.8:1 Kontrast */
}
```

| Token | Wert | Verwendung |
|---|---|---|
| `base` | `#141414` | App-Hintergrund (die "unterste" Fläche) |
| `surface-1` | `#1a1a1a` | Sidebar, Statusbar-Pill, Panels, Modals, Dropdowns |
| `surface-2` | `#232323` | Hover/Active/Selected Rows (eine Stufe heller als surface-1) |
| `border` | `white / 5%` | Standard-Trennlinie (sehr dezent) |
| `border-strong` | `white / 10%` | Modal-/Panel-Außenrahmen, wichtigere Trennlinien |
| `content-primary` | `#EDEDEC` | Haupttext, aktive Items, Titel |
| `content-secondary` | `#a3a3a3` | Fließtext, Body-Copy |
| `content-tertiary` | `#737373` | Meta-Infos, Labels, Placeholder, inaktive Icons |
| `accent` | `#F5A623` | Links, Fokus-Ring, aktive Icons, primäre Buttons |
| `accent-soft` | `rgba(245,166,35,.5)` | Zitat-Randlinie, dezente Akzent-Flächen |
| `accent-strong` | `#D97706` | Solide Akzentfläche mit weißem Text (genug Kontrast) |
| `success` | `#4ADE80` | Saved-Status-Dot, kleine Erfolgs-Icons |
| `success-strong` | `#15803D` | Solide grüne Fläche (selten, weißer Text) |
| `danger` | `#F87171` | Fehlertexte, Konfliktmeldungen |
| `danger-strong` | `#DC2626` | Destruktive Buttons ("Löschen") — solide Fläche |

**Verboten:**
- Reines `#000000` als Hintergrund
- Harte weiße Borders (`#fff` statt `white/5`–`white/10`)
- Große flächige Grün-/Rot-Bereiche (nur kleine Akzente/Dots/Badges)
- Mehr als einen Akzentton gleichzeitig

**Regel für neue Werte:** Taucht ein neuer Farbwert auf, wird er zuerst als
benannter Token zentral definiert (analog `tailwind.config.ts` → `theme.extend.colors`),
danach ausschließlich über den Token verwendet. Nie direkt einen Hex-Wert in
einer Komponente hardcoden.

---

## 2. Typografie

**Font-Stack:**
```css
--font-sans: 'Inter', system-ui, sans-serif;   /* UI-Text */
--font-mono: '"JetBrains Mono"', ui-monospace, monospace; /* Code, Shortcuts, Stats */
```

| Element | Größe / Gewicht | Farbe | Beispiel-Kontext |
|---|---|---|---|
| Dokument-Titel (H1) | `36px`/`48px` (md+) · `font-weight: 700` · `letter-spacing: -0.01em` | `content-primary` | Editor-Dokumenttitel |
| Section-Heading (H2) | `20px` · `font-weight: 600` · Border-bottom `1px solid border` · `padding-bottom: 8px` | `content-primary` | Content-Abschnitte |
| Body | `16px` · `line-height: 1.7` | `content-secondary` | Fließtext |
| Meta/Label | `12px` · `text-transform: uppercase` · `letter-spacing: 0.05em` · `font-weight: 500` | `content-tertiary` | Sidebar-Sektionslabels ("COLLECTIONS"), Statusbar-Werte |
| Dokument-Meta-Zeile | `14px`, normale Groß-/Kleinschreibung | `content-tertiary` | "zuletzt bearbeitet vor 2 Stunden" (bewusst NICHT uppercase — anders als Meta/Label) |
| Code/Mono | `14px` · `font-mono` | `content-primary` | Inline-Code, Shortcut-Badges |

Überschriften-Größenverhältnisse (relativ, für z. B. Live-Preview/Markdown-Rendering):
```
h1: 2.143em   (≈30px bei 14px Basis)
h2: 1.429em   (≈20px)
h3: 1.286em   (≈18px)
h4: keine Größenänderung — nur bold + tight tracking
```

Überschriften/Prose-Feinschliff:
- Links: `text-decoration: underline; text-underline-offset: 2px;` (kein extra Fettgewicht)
- h1: `margin-top: 0; margin-bottom: 1.2em; font-weight: 700`
- h2: `margin-top: 2em; margin-bottom: 0.5em` + Border-bottom (siehe oben) — großzügiger Abstand *davor* (neue Sektion), knapper *danach* (gehört zum Inhalt)
- h3: `margin-top: 1.75em; margin-bottom: 0.5em`
- Listen: `padding-left: 1.5em`, Items `margin: 0.35em 0`
- Blockquote: `font-style: italic; font-weight: 400; border-left: 2px solid accent-soft; background: rgba(255,255,255,0.02); padding: 8px 16px;`
- Inline-Code (außerhalb `<pre>`): `background: rgba(255,255,255,0.06); border-radius: 6px; padding: 0.15em 0.4em;`
- Code-Blöcke (`<pre>`): `background: surface-2; border: 1px solid border;`

---

## 3. Radius & Spacing

| Kontext | Wert |
|---|---|
| Panels/Cards/Modals | `8px` (`rounded-lg`) bis `12px` (`rounded-xl`) |
| Buttons, Inputs, Zeilen | `6px` (`rounded-md`) |
| Pills/Badges/Toggle-Buttons/Toasts | `9999px` (voll rund) |
| Checkboxen | `4px` (`rounded`) |
| Editor-Schreibspalte | `750px` max-width |
| Reader-Content-Spalte | `680–768px` max-width (`max-w-3xl`) |
| Sidebar-Breite | `256px` (`w-64`) |
| Statusbar-Höhe | `32–36px` (`h-8`–`h-9`) |
| Vertikaler Rhythmus zwischen Content-Blöcken | `24–32px` (`space-y-6`–`space-y-8`) |
| Button/Input Padding | `16px` horizontal, `8px` vertikal (`px-4 py-2`) |
| Sidebar-Zeilen Padding | `10px` horizontal, `6–8px` vertikal (`px-2.5 py-2`) |
| Icon-Größen | `16px` (`w-4 h-4`) Standard, `20px` (`w-5 h-5`) größere Kontexte |

**Nie:** `32px`+ Radius-Extreme, willkürliche Pixel-Werte außerhalb der Skala.

---

## 4. Shadows & Blur

Schatten sind **die Ausnahme**, nicht die Regel — nur bei schwebenden UI-
Ebenen, immer zusammen mit Backdrop-Blur:

```css
--shadow-float: 0 20px 60px rgba(0, 0, 0, 0.5);
```

Verwendung: `box-shadow: var(--shadow-float); backdrop-filter: blur(12px);`
— nur bei Command Palette, Modals/Dialoge, Context-Menüs, Dropdowns.

Backdrop für Modal-Overlays: `background: rgba(0,0,0,0.4); backdrop-filter: blur(12px);`

---

## 5. Motion / Transitions

- Standard-Übergang für Hover/Active: `transition: color 150ms ease-out, background-color 150ms ease-out;`
- Enter-Animation (Dialoge, Menüs, Panels): `150ms ease-out`, von `opacity: 0; transform: scale(0.95);` nach `opacity: 1; transform: scale(1);`
- Leave-Animation: `100ms ease-in` (bewusst schneller als enter — wirkt reaktionsschneller), zurück zu `opacity: 0; transform: scale(0.95);`
- Backdrops: nur Fade (`opacity` 0↔1), kein Scale
- Toasts: leichtes Slide+Fade (`translateY(8px) → 0`, `opacity 0 → 1`)
- **Kein** `active:scale-95` oder ähnliches Touch-Tactile-Feedback — das ist ein Desktop-Editor
- **`prefers-reduced-motion: reduce` respektieren**: alle Animation-/Transition-Dauern auf `0.01ms` setzen, `scroll-behavior: auto` erzwingen (einmal global, nicht pro Komponente)
- Grid-basierte Expand/Collapse-Animation (z. B. Baum-Ordner) statt `height: auto` (nicht animierbar): zwei benannte Grid-Template-Rows-Zustände (`0fr` ↔ `1fr`) auf einem Wrapper, innerer Content-Layer mit `overflow: hidden`

---

## 6. Fokus & States

```css
/* Global, EINMAL definiert, nicht pro Button */
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 1px var(--color-accent-soft); /* entspricht ring-1 ring-accent/50 */
}
```
- Nur `:focus-visible`, nicht `:focus` — Maus-/Touch-Klicks zeigen keinen Ring, nur Tastatur-Fokus
- Hover (allgemein, nicht-primäre Elemente): `background: rgba(255,255,255,0.04); transition: background-color 150ms;`
- Aktive/Selected Row: `background: var(--color-surface-2); border-radius: 6px; font-weight: 500; color: var(--color-content-primary);`
- Disabled: `opacity: 0.5; cursor: not-allowed;`

---

## 7. Custom Scrollbar

Dezent, "unsichtbar bis gebraucht" (Notion/VS Code-Stil) — nur bei
`pointer: fine` (Desktop), Touch-Geräte behalten native Scrollbars.

```css
@media (pointer: fine) {
  * {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent; /* idle: unsichtbar */
  }
  *:hover, *:focus-within {
    scrollbar-color: rgba(255,255,255,0.10) transparent; /* = border-strong */
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 9999px;
    transition: background-color 150ms ease-out;
  }
  *:hover::-webkit-scrollbar-thumb,
  *:focus-within::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.10);
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(115,115,115,0.5); /* content-tertiary/50 */
  }
}
```

---

## 8. Icons

- Nur **Outline-Style**-Icons (Referenz-App nutzt `@lucide/vue` / Lucide-Icon-Set — in Tauri z. B. `lucide-react` oder das native Lucide-SVG-Set verwenden)
- Strichstärke `1.5`–`1.75`
- Keine gefüllten Icons, **außer** bei aktiven/selektierten Zuständen (z. B. aktiver View-Toggle, favorisierter Stern: `fill: currentColor`)
- Standardgrößen `16px`/`20px`, keine krummen Pixel-Werte

---

## 9. Fertige Component-Recipes (direkt übernehmbar)

Alle Werte als reines CSS, 1:1 aus den Tailwind-Klassen der Original-App
übersetzt — direkt in jedes Frontend-Framework portierbar.

### Primär-Button
```css
.btn-primary {
  border-radius: 6px;
  padding: 8px 16px;
  background: var(--color-accent);
  color: var(--color-content-primary);
  font-weight: 500;
  transition: background-color 150ms ease-out;
}
.btn-primary:hover { background: color-mix(in srgb, var(--color-accent) 90%, transparent); }
.btn-primary:disabled { cursor: not-allowed; opacity: 0.5; }
```

### Sekundär-/Cancel-Button
```css
.btn-secondary {
  border-radius: 6px;
  padding: 8px 16px;
  border: 1px solid var(--color-border-strong);
  color: var(--color-content-primary);
  transition: background-color 150ms ease-out;
}
.btn-secondary:hover { background: rgba(255,255,255,0.04); }
```

### Destruktiver Button
```css
.btn-danger {
  border-radius: 6px;
  padding: 8px 16px;
  background: var(--color-danger);
  color: white;
}
.btn-danger:hover { background: color-mix(in srgb, var(--color-danger) 90%, transparent); }
```

### Text-Input
```css
.input {
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-content-primary);
  padding: 8px 12px;
  transition: box-shadow 150ms ease-out;
}
.input:focus {
  outline: none;
  box-shadow: 0 0 0 1px var(--color-accent-soft);
}
```

### Sidebar — Zeile (Standard)
```css
.sidebar-row {
  display: flex; align-items: center; gap: 8px;
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--color-content-secondary);
  cursor: pointer;
  transition: background-color 150ms ease-out;
}
.sidebar-row:hover { background: rgba(255,255,255,0.04); color: var(--color-content-primary); }
```

### Sidebar — aktiver Eintrag
```css
.sidebar-row.active {
  background: var(--color-surface-2);
  color: var(--color-content-primary);
  font-weight: 500;
}
```

### Sidebar — Favoriten-Stern
```css
.favorite-star { color: var(--color-content-tertiary); }
.favorite-star:hover { color: var(--color-accent); }
.favorite-star.active { color: var(--color-accent); } /* + fill: currentColor */
```

### Segmented-Control / View-Toggle — aktiv
```css
.toggle-pill.active { background: var(--color-accent); border-radius: 9999px; color: white; }
.toggle-pill { color: var(--color-content-tertiary); }
.toggle-pill:hover { color: var(--color-content-secondary); }
```

### Statusbar (floating Pill)
```css
.statusbar {
  position: fixed; bottom: 12px; right: 12px;
  height: 36px;
  border-radius: 9999px;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-strong);
  display: flex; align-items: center; gap: 12px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--color-content-tertiary);
}
/* Save-Status-Dot */
.save-dot { width: 8px; height: 8px; border-radius: 9999px; background: var(--color-success); transition: transform 200ms; }
.save-dot.just-saved { transform: scale(1.5); }
```

### Inline-Code / Shortcut-Badge
```css
.kbd {
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  padding: 2px 6px;
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--color-content-primary);
}
```

### Modal / Dialog
```css
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(12px);
  display: flex; align-items: center; justify-content: center;
}
.modal-panel {
  width: 100%; max-width: 448px;
  border-radius: 12px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-1);
  padding: 24px;
  box-shadow: var(--shadow-float);
  color: var(--color-content-primary);
}
```
Buttons im Modal: rechtsbündig, `gap: 8px` — Cancel = `.btn-secondary`,
Confirm = `.btn-primary` (oder `.btn-danger` bei destruktiven Aktionen).

### Command Palette
```css
.cmdk-panel {
  background: var(--color-surface-1);
  border-radius: 12px;
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-float);
}
.cmdk-row.active { background: var(--color-surface-2); border-radius: 6px; }
.cmdk-shortcut { color: var(--color-content-tertiary); font-family: var(--font-mono); font-size: 12px; }
```

### Kontextmenü / Dropdown
```css
.context-menu {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  box-shadow: var(--shadow-float);
  padding: 4px;
}
.context-menu-item {
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--color-content-secondary);
}
.context-menu-item:hover { background: rgba(255,255,255,0.04); color: var(--color-content-primary); }
.context-menu-item.destructive { color: var(--color-danger); }
```

### Slash-Menü (tastaturgetrieben — bewusst volltoniger Akzent statt surface-2)
```css
.slash-group-header {
  font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--color-content-tertiary); font-weight: 500;
  padding: 8px 14px 4px;
}
.slash-item.active { background: var(--color-accent); border-radius: 6px; color: white; }
.slash-item .shortcut-hint { color: var(--color-content-tertiary); font-family: var(--font-mono); font-size: 12px; }
.slash-item.active .shortcut-hint { color: rgba(255,255,255,0.7); }
.slash-footer {
  border-top: 1px solid var(--color-border);
  padding: 8px 14px;
  font-size: 12px;
  color: var(--color-content-tertiary);
}
```

### Toast
```css
.toast {
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-strong);
  border-radius: 9999px;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--color-content-primary);
}
```

### Checkbox
```css
.checkbox { width: 16px; height: 16px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); }
.checkbox.checked {
  background: var(--color-accent);
  display: flex; align-items: center; justify-content: center;
  /* + weißes Check-Icon */
}
```

### Tabelle
```css
.table-header { color: var(--color-content-tertiary); font-size: 12px; text-transform: uppercase; border-bottom: 1px solid var(--color-border); }
.table-row { border-bottom: 1px solid var(--color-border); }
.table-row:last-child { border-bottom: none; }
```

### Callout / Blockquote
```css
.callout {
  border-left: 2px solid rgba(245,166,35,0.6); /* accent/60 */
  background: rgba(255,255,255,0.02);
  font-style: italic;
  color: var(--color-content-secondary);
  padding: 8px 16px;
}
```

### Skeleton/Loading
```css
.skeleton { background: rgba(255,255,255,0.05); border-radius: 6px; }
/* + eine übliche pulse-Keyframe-Animation, opacity 1 <-> 0.5, ~2s */
```

### Breadcrumb
```css
.breadcrumb { display: flex; align-items: center; gap: 4px; font-size: 14px; color: var(--color-content-tertiary); }
.breadcrumb .segment-last { color: var(--color-content-secondary); }
/* Trenner: kleines Chevron-Right-Icon, 14px */
```

### Empty State
```css
.empty-state { text-align: center; color: var(--color-content-tertiary); }
.empty-state .icon { color: var(--color-content-tertiary); }
.empty-state .text { font-size: 14px; color: var(--color-content-tertiary); }
```

---

## 10. Layout-Referenz (App-Shell)

- **Sidebar**: fest `256px` breit, `background: surface-1`, Border rechts (`border-color`)
- **Content-Bereich**: `background: base`
- **Editor-Schreibspalte**: zentriert, `max-width: 750px`
- **Reader/Preview-Spalte**: zentriert, `max-width: ~680–768px`
- **Statusbar**: NICHT als volle Leiste — schwebende Pill unten rechts (`fixed bottom-12 right-12`), damit sie nie Content/Empty-States überlappt
- **Scroll-Architektur**: `html`/`body` sind der fixe Rahmen (`height: 100%; overflow: hidden;`), tatsächliches Scrollen passiert nur innerhalb einzelner Panels (Sidebar, Editor, Command Palette, …) — verhindert Rubber-Banding/Bounce auf iOS/Android
- Bei mobilen Layouts: `100dvh` statt `100vh` verwenden (berücksichtigt ein-/ausblendende Browser-Chrome)

---

## 11. Do / Don't Zusammenfassung

| Do | Don't |
|---|---|
| Borders (`white/5`–`white/10`) zur Flächentrennung | Große weiche Drop-Shadows auf jeder Card |
| `8–12px` Radius für Panels | `24px+`/`32px`-Radius-Extreme |
| Ein Akzentton (Amber `#F5A623`), sparsam | Mehrere bunte Akzentfarben gleichzeitig |
| Grün nur als kleiner Saved-Status-Dot | Grün als große Flächenfarbe |
| Backdrop-Blur nur bei Modals/Command Palette | Backdrop-Blur überall als Deko |
| `transition-colors` (150ms) für Hover/Active | `scale-95`-Tap-Feedback wie bei Mobile-Apps |
| Zentrale Token für Farbe/Radius/Spacing | Hardcodierte Hex-/Pixel-Werte verstreut im Code |
| Outline-Icons, gefüllt nur bei aktivem Zustand | Gemischte Icon-Stile |
| `:focus-visible` mit dünnem `accent/50`-Ring | Dicke/knallige Fokus-Ringe, oder gar keine |

---

## 12. Kurz-Zusammenfassung für die Ziel-KI (Copy-Paste-Prompt)

> Baue die UI im Stil eines "Quiet Dark Editor" (wie Obsidian/Bear/iA Writer):
> Hintergrund `#141414`, Panels `#1a1a1a`/`#232323`, Text `#EDEDEC`
> (primär)/`#a3a3a3` (sekundär)/`#737373` (tertiär), ein einziger warmer
> Akzentton `#F5A623` (Amber) für Links/Fokus/aktive Elemente, Grün `#4ADE80`
> nur für Saved-Status, Rot `#F87171` nur für Fehler. Trennung zwischen
> Flächen ausschließlich über 1px-Borders bei `white/5`–`white/10` Opazität,
> keine Schatten außer bei schwebenden Elementen (Modals, Command Palette,
> Toasts — dort `0 20px 60px rgba(0,0,0,0.5)` + Backdrop-Blur). Radien 6px
> (Buttons/Inputs) bis 12px (Panels/Modals), Pills/Badges/Toasts voll rund.
> Schrift: Inter für UI-Text, JetBrains Mono für Code. Alle Hover/Active-
> Übergänge `150ms ease-out` (nur Farbe, kein Scale/Tactile-Feedback). Ein
> globaler `:focus-visible`-Ring in `accent/50`, keine anderen Fokus-Stile.
