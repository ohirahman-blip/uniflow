# UniFlow 0.8 — eigene Klausuren und Hausaufgaben

## Änderungen
- Hausaufgaben und Klausuren werden als **Assessment** unter `assessments` gespeichert, nicht als `Offering`.
- Im Kalender erscheinen kleine klickbare Symbole beim jeweiligen Datum: 🎓 Prüfung / 📋 Hausaufgabe. Kein Zeitblock, kein Wallet, keine Aussetzen-Funktion.
- Über das + in der Kalenderleiste Klausur bzw. Hausaufgabe hinzufügen. Anschließend am Symbol bearbeiten und löschen. Hausaufgaben können als erledigt markiert werden. Uhrzeit ist optional.
- Die Module-Übersicht bezieht ihre Klausur-Countdowns aus den neuen Datensätzen.
- Vorhandene alte `Klausur`/`Hausaufgabe`-Offerings werden beim Laden **einmalig** in Assessments umgewandelt, auch bei früheren wöchentlichen Einträgen (bis 550 Einzeltermine pro Reihe). Deterministische IDs vermeiden Doppelteinträge. Bereits vorhandene moderne Assessments bleiben bestehen.
- Löschen einer gesamten Veranstaltungsreihe ist im Editor verfügbar, mit der bestehenden Gruppen-Löschbestätigung.
- Die im Chat beschriebenen lokalen Änderungen bleiben erhalten: Doppeltipp auf freie Kalenderslots; keine Hinweiszeilen unter dem Kalender oder im Wallet; Wallet bleibt beim Öffnen/Erweitern im sichtbaren Bildschirm und kann nach oben ausweichen.
- Beim Löschen von Modul/Semester werden zugehörige Assessments mitgelöscht.

## Installation
**Zuerst in UniFlow unter Einstellungen ein JSON-Backup herunterladen.**

Update-ZIP: `src/App.tsx`, `src/model.ts`, `src/styles.css` in den gleichnamigen Pfaden des bestehenden Projekts ersetzen. Optional `test-v08.cjs`, `package.json` und diese Anleitung übernehmen.

**Deine `.env.local` nicht überschreiben und nicht öffentlich hochladen.** Das vollständige ZIP enthält absichtlich keine `.env.local`.

Danach im Projektverzeichnis `npm install` und `npm run dev`. Die Migration benötigt **kein neues Supabase-SQL**, da dein Workspace bereits als JSON synchronisiert wird.

## Tests / Grenzen
Vorhandene 330 Modell-Assertions, neue v0.8-Migrationstests und TypeScript-TSX-Syntaxprüfung sind durchgelaufen. Ein vollständiger Browser- und iPhone-Test sowie der vollständige TypeScript-Build konnten hier wegen fehlender installierter npm-Pakete nicht durchgeführt werden.
