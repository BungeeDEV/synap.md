# synap – Sync-Plan: Web-App ↔ Tauri-Desktop-App

Diese Datei ist die gemeinsame Referenz für zwei Repos: die bestehende
synap.md-Web-App (Nuxt/Nitro) und eine neue Tauri-Desktop-App (z.B.
`synap-desktop`). Beide Repos bekommen diese Datei (z.B. unter
`docs/sync-plan.md`) — sie beschreibt den Gesamtplan, damit Claude Code
in beiden Repos denselben Kontext hat, auch wenn jeweils nur der eigene
Teil umgesetzt wird.

## Ziel

Eine native Tauri-2-Desktop-App (Rust-Backend), die den Vault
vollständig lokal hält, komplett offline editierbar macht, und im
Hintergrund mit dem Server abgleicht — sodass Web-Vault (z.B. am Handy)
und Tauri-App (PC) immer denselben Stand zeigen. Obsidian-artige
Bedienung als Vorbild.

## Architektur-Entscheidungen (bereits getroffen, nicht neu diskutieren)

- **Sync-Mechanismus**: REST-Diff-Sync, hash-/mtime-basiert. Kein Git,
  keine eingebaute Versionshistorie.
- **Konfliktstrategie**: Last-Write-Wins + Konfliktkopie bei echtem
  Gleichzeitig-Konflikt (wie Dropbox), kein CRDT/Realtime-Merging.
- **Setup**: Single-User über mehrere Geräte, kein Multi-User-Merging
  nötig.
- **Client-Stack**: Tauri 2 + Rust, explizit kein Electron. Tooling/
  Signing-Konventionen können vom bestehenden Tauri-2-Projekt
  `nexo-suite` übernommen werden.
- **Bestehendes Server-Modell bleibt unangetastet**: Vault = Ordner mit
  echten .md-Dateien auf der Server-Platte, SQLite ist und bleibt nur
  rebuildbarer Cache, nie Daten-Owner. `resolveVaultPath()` bleibt der
  einzige Sicherheits-Choke-Point für jeden Dateipfad — auch für neue
  Sync-Endpoints, ausnahmslos.

## Phasenplan (Reihenfolge verbindlich, jede Phase erst nach Bestätigung)

| Phase | Inhalt | Repo |
|---|---|---|
| 0 | Validierung/Proof-of-Concept: Verbindung, Dateiliste, eine Datei laden+speichern | Tauri (+ minimale Server-Endpoints) |
| 1 | Lokales Vault + vollständige Sync-Engine (Diff, Konflikte, Löschungen) | Tauri + Server |
| 2 | Editor-Wiederverwendung statt Textfeld (CodeMirror/Magic View/Sidebar) | Tauri (+ ggf. Web-App für Extraktion) |
| 3 | Native Politur (sichere Token-Ablage, Tray, natives Drag&Drop-Import, Notifications, Autostart) | Tauri |

Phase 0 hat Priorität — Zweck ist der Beweis, dass die Kette
grundsätzlich funktioniert, bevor in Sync-Engine, sichere Auth-Ablage
oder den vollen Editor investiert wird.

---

## Teil A — Verantwortlichkeiten im Web-App-Repo (synap.md)

### A1. Manifest-Endpoint
`GET /api/vault/manifest` — liefert für den gesamten Vault eine Liste
`{ path, hash, mtime, size }` pro Datei (Hash z.B. SHA-256 über den
Inhalt). Prüfen, ob der bestehende Indexer (`server/utils/indexer.ts`)
diese Metadaten schon mitführt, sonst Caching-Strategie fürs Hashing
überlegen (nicht bei jedem Request den kompletten Vault neu hashen).

### A2. Batch-Sync-Endpoints
- `POST /api/vault/sync/pull` — Liste von Pfaden rein, Inhalt +
  aktueller Hash/mtime pro Datei raus
- `POST /api/vault/sync/push` — Liste von
  `{ path, content, expectedMtime }` rein, schreibt über denselben
  Pfad wie das bestehende `PUT /api/vault/file` (inkl. dessen
  409-Konflikterkennung), aber gebündelt; Antwort pro Datei: Erfolg
  oder 409 mit aktuellem Server-Stand
- Jeder Pfad in beiden Endpoints durch `resolveVaultPath()`

### A3. Auth für Nicht-Browser-Clients
Prüfen, ob bereits ein Token-/API-Key-Mechanismus abseits der
Session-Cookie-Middleware (`requireUserSession`) existiert. Falls
nicht: einfachen Personal-Access-Token-Mechanismus ergänzen (in den
Einstellungen generierbar, Anzeige-nur-einmal, optional mit
Ablaufdatum) für die Tauri-App.

---

## Teil B — Verantwortlichkeiten im Tauri-Repo (synap-desktop)

### B0. Phase 0 — Validierung
- Tauri-2-Projekt aufsetzen (Struktur/Signing an `nexo-suite` anlehnen)
- Minimales Frontend: Server-URL + Token-Eingabe (Token vorerst nur im
  Klartext-State, wird in Phase 3 ersetzt)
- Rust-Command gegen `GET /api/vault/manifest` (Teil A1)
- Einfache Dateiliste im UI
- Datei anklicken → Inhalt via `sync/pull` laden, in simplem Textfeld
  anzeigen (kein Markdown-Rendering nötig)
- Bearbeiten + Speichern via `sync/push`

**Definition of Done**: App verbindet sich, zeigt Vault-Dateiliste,
kann eine Datei laden/bearbeiten/speichern. Kein lokales Vault, kein
Offline-Modus, kein Diffing.

### B1. Phase 1 — Lokales Vault + Sync-Engine
- Lokalen Vault-Root wählen/anlegen (Dialog beim ersten Start)
- Lokale SQLite-Cache-DB (`rusqlite`/`sqlx`): pro Datei lokaler
  Hash/mtime UND letzter-erfolgreicher-Sync-Hash/mtime (für
  3-Wege-Diff: lokal vs. letzter Sync vs. Server)
- Datei-Watcher (`notify`-Crate) für sofortige lokale
  Änderungserkennung
- HTTP-Client (`reqwest`) gegen Teil A1/A2, Auth über Token aus Phase 0
- Sync-Orchestrierung: voller Abgleich beim Start, periodischer
  Hintergrund-Sync, sofortiger Sync-Versuch bei lokaler Änderung
  (debounced), Offline-Warteschlange bei fehlgeschlagenen Requests,
  automatisches Nachholen bei Wiederverbindung
- Konfliktbehandlung: nur-lokal-geändert → hochladen,
  nur-remote-geändert → herunterladen, beides-geändert → lokale
  Version behalten + Server-Version als Konfliktkopie
  (`Titel (Konflikt vom Datum).md`), sichtbar im UI markieren
- Löschungen: erst gegen andere neue lokale Dateien hash-vergleichen
  (Move/Rename-Erkennung) bevor als Löschung an den Server propagiert
  wird

**Definition of Done**: zwei Geräte zeigen nach kurzer Zeit denselben
Vault-Stand, auch nach Offline-Änderungen. Echte Konflikte erzeugen
eine Konfliktkopie statt Datenverlust.

### B2. Phase 2 — Echter Editor
- Prüfen, ob sich die bestehenden CodeMirror-6-Extensions
  (`app/editor/*.ts` im Web-App-Repo, inkl. Magic View) und relevante
  Vue-Komponenten in ein gemeinsames Package auslagern lassen, das
  sowohl die Nuxt-Web-App als auch die Nuxt-lose Vite+Vue-Frontend der
  Tauri-App konsumieren — verhindert zwei unabhängig gepflegte
  Editor-Implementierungen, die auseinanderlaufen. Falls Extraktion zu
  aufwändig: Aufwand für spätere Angleichung einschätzen, vorerst
  API-kompatible separate Kopie.
- Sidebar/Baum, Tabs, Formatierungs-Toolbar, Magic View,
  Slash-Command-Menü aus der Web-App übernehmen/wiederverwenden

### B3. Phase 3 — Native Politur
- Klartext-Token aus Phase 0 ersetzen durch sichere Ablage
  (`tauri-plugin-stronghold` oder OS-Keychain-Plugin)
- System-Tray-Icon (Sync auch bei minimiertem Fenster)
- Natives Drag & Drop für .md-Import (bereits gespectes
  Import-Feature aus der Web-App-Runde, nativ einfacher umsetzbar)
- Native OS-Benachrichtigungen bei Sync-Konflikten
- Optionaler Autostart beim Login

---

## Cross-Cutting Anforderungen (gelten für beide Repos)

- `resolveVaultPath()` für jeden Dateipfad, ausnahmslos, auch in neuen
  Batch-/Sync-Endpoints
- Bestehenden Schreibpfad und 409-Konflikterkennung von
  `PUT /api/vault/file` wiederverwenden statt duplizieren
- Kein Electron, keine Node-Runtime im Tauri-Client
- Rust-Code idiomatisch, async wo sinnvoll (Tauri 2 nutzt async
  Commands nativ)
- STYLEGUIDE.md (Tailwind v4 Tokens etc.) gilt für alle UI-Änderungen
  im Web-App-Repo

## Offene Punkte, die der jeweilige Statusbericht klären soll

- Existiert bereits Token-/API-Key-Auth abseits der Session-Cookies?
- Führt der Indexer bereits Hash/mtime pro Datei, oder muss das neu
  berechnet werden?
- Wie realistisch ist eine echte Code-Extraktion für Phase 2
  (gemeinsames Editor-Package) angesichts der aktuellen
  srcDir-Struktur (Nuxt `app/` vs. `server/`)?
