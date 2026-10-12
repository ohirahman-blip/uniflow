# UniFlow 0.7 — Veranstaltungsthemen und gleichwertige Gruppen

Diese Version basiert direkt auf UniFlow 0.6.2. Die bestehende Registrierung,
Supabase-Anmeldung, das Cloud-Workspace-Format und die Administrationsfunktionen
bleiben erhalten. Es ist **keine SQL-Migration erforderlich**.

## Installation (nur geänderte Dateien)

1. **Vorher** in UniFlow unter Einstellungen eine JSON-Sicherung herunterladen.
2. Den Projektordner zusätzlich als Kopie sichern.
3. Die Dateien dieses Updates in deinen bestehenden Ordner `uniflow-prototyp`
   kopieren; Pfade beibehalten und vorhandene Dateien überschreiben.
4. Deine `.env.local` **nicht ersetzen oder löschen**.
5. Entwicklungsserver neu starten: `npm run dev -- --host 0.0.0.0`.
6. Browserseite auf iPhone / Mac aktualisieren.

## So benutzt du die neue Funktion

- **Module → Modul antippen:** Es öffnet sich eine echte Modulseite statt eines
  Einstellungs-Popups.
- **Inhalt anlegen:** z. B. `VL 01` auswählen und den ersten Termin eintragen.
- **Gleichwertige Gruppe hinzufügen:** innerhalb dieses Inhalts weiteren
  Dozenten, Raum und Tag angeben. Diese Gruppe bleibt zunächst inaktiv und
  erhält eine eigene feste Veranstaltungs-ID.
- **Bestehende Reihe zuordnen:** ältere, einzeln angelegte Reihen desselben
  Moduls und derselben Veranstaltungsart einem Inhalt zuweisen, **ohne** sie
  neu anzulegen. Nützlich bei bisherigen Doppelstrukturen.
- **Kalender:** Nicht ausgewählte Termine ohne belegten Zeitslot werden
  transparent dargestellt. Antippen → einmalig oder immer besuchen, oder
  zwischen gleichwertigen Gruppen wechseln. Bei belegtem Slot sind die
  anderen Angebote in den Termindetails unter „Andere Veranstaltung zur
  gleichen Zeit“ erreichbar.
- **Zukünftige Ausnahmen:** Einmalige Auswahländerungen und einzelne
  Verschiebungen sind auf der Modulseite einklappbar; Vergangenheit wird dort
  nicht angezeigt. Vergangene Daten bleiben weiterhin in der Datensicherung.
- **Heute:** bringt die Kalenderansicht zum aktuellen Datum zurück.

## Wichtige Hinweise

- Jede Veranstaltung bleibt **eine** Reihe. Änderungen der Auswahl erfolgen
  über Einträge im Feld `overrides`, nicht durch Kopieren von Veranstaltungsreihen.
- Die bestehende `contentId` bestimmt, welche Gruppen inhaltlich äquivalent
  sind. Nicht jedes Angebot im selben Modul gehört automatisch zum selben
  Inhalt. Verwende die neue Modulseite, um die Gruppen bewusst zuzuordnen.
- Bereits **vor** 0.6.2 entstandene doppelte Termine werden **nicht**
  automatisch gelöscht. Du kannst vorhandene Reihen zu Gruppen ordnen und
  echte Duplikate nach Prüfung selbst entfernen.
- Die Cloud speichert wie bisher das Workspace-JSON. Eine automatische
  Zusammenführung **gleichzeitiger** Änderungen auf zwei Geräten ist noch
  nicht implementiert. Nutze zum Testen möglichst nur ein Gerät auf einmal.
- Ohne installierte npm-Abhängigkeiten konnte in der Erstellumgebung kein
  vollständiger Browser-Build ausgeführt werden. Die vorhandenen und neuen
  Datenmodelltests sowie eine statische TSX-/TypeScript-Prüfung waren erfolgreich.

## Start & Tests

```bash
npm install
npm run dev -- --host 0.0.0.0
npm test
```

Fragen beim Testen? Ein Screenshot von Modul > VL 01 und vom zugehörigen
Kalendertag vor und nach der Auswahl hilft bei der Fehlersuche.
