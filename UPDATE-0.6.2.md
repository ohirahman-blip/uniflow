# UniFlow 0.6.2 — stabile Lehrgruppen

Die bestehende Version 0.6.1 wurde kopiert. Geändert wurden nur `src/model.ts`, `src/App.tsx`, `src/styles.css` und `package.json`; neu sind `test-groups.cjs` und dieses Dokument.

## Neue Bedienung

- **Details auf Tag, 2 Tage und Woche:** Lehrperson, Raum und Uhrzeit sind auf den Terminkarten sichtbar (wenn eingetragen). Bei sehr kurzen Terminen bleibt der Platz begrenzt.
- **Gleicher Inhalt:** Im Termin auf *Gleicher Inhalt* gehen und weitere Lehrgruppen z. B. Winkert, Narben, Keipert als eigene Veranstaltungsangebote hinzufügen. Alle Gruppen gehören zum **gleichen Modul** und werden über eine gemeinsame Inhalts-ID verbunden. Sie können verschiedene Wochentage, Räume, Lehrpersonen und Rhythmen haben.
- **Andere Veranstaltung zur selben Zeit:** Zeigt auch Angebote anderer Module, die zeitlich konkurrieren. Beide Beziehungen werden automatisch aus dem Veranstaltungspool abgeleitet.
- **Alternative auswählen:** Entscheide zwischen *Zur anderen Gruppe wechseln* (der vorherige Termin wird lediglich ausgeblendet) und *Beide besuchen*. Danach *Nur dieses Mal* oder *Ab jetzt und zukünftig* bestätigen. Bei Überschneidungen erscheint eine Warnung; beide können absichtlich nebeneinander im Kalender stehen.
- **Keine Duplikate beim Hin- und Herwechseln:** Der Wechsel verändert nur die Terminauswahl pro Vorkommen (in `overrides.selected`). Es wird **keine neue Veranstaltungsreihe** angelegt. Künftiges Verschieben wird über `scheduleChanges` derselben Reihe geführt, nicht mehr über eine geklonte Reihe.
- **Zweiwöchentliche Gruppen:** Der alte Termin bleibt in Wochen bestehen, in denen die ausgewählte Ersatzgruppe nicht stattfindet.

## Installation

1. Vorher im laufenden UniFlow unter *Mehr → Backup herunterladen* ein Backup erstellen. Eine Kopie des Projektordners ist ebenfalls sinnvoll.
2. Aus dem kleinen ZIP die Dateien in die **entsprechenden Pfade** des bisherigen Projekts kopieren. **`.env.local` nicht überschreiben.**
3. Den lokalen Vite-Server mit `Ctrl+C` stoppen und mit `npm run dev -- --host 0.0.0.0` neu starten.
4. Kalender mit mehreren Gruppen und Überschneidungen ausprobieren.

Die vorhandene Supabase-Datenbank benötigt **keine neue SQL-Migration**, da die Termine weiterhin als persönlicher Workspace-JSON-Datensatz gespeichert werden. Die Cloud-Daten werden nicht automatisch auf einen neuen Schlüssel umgezogen.

### Hinweise

- Bereits **früher** versehentlich angelegte Duplikate können im bestehenden Workspace noch vorhanden sein. UniFlow entfernt diese **nicht automatisch**, da man echte doppelte Veranstaltungseinträge sonst versehentlich löschen könnte. Diese bitte nach einem Backup gezielt bereinigen.
- Dies ist ein Logik- und Syntax-geprüftes Update. Ein vollständiger Browser- / iPhone-Test und ein React-Build waren in der Erstellungsumgebung mangels installierter npm-Pakete nicht möglich.
- Einmalige Änderungen und laufende Serienentscheidungen werden als Auswahl-Overrides gespeichert. Gleichzeitige Cloud-Bearbeitungen auf mehreren Geräten werden weiterhin nicht zusammengeführt (Last-write-wins).

## Tests

`npm test` führt 18 ältere, 29 gruppenbezogene und 136 neue Assertions aus, darunter 30 Hin-und-Her-Wechsel sowie wiederholte Verschiebungen ohne neue IDs.
