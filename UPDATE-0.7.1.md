# UniFlow 0.7.1 – Kartenfächer, Aussetzen und Löschen

Dieses Update basiert auf UniFlow 0.7. Kopiere die Dateien im Update-ZIP an die entsprechenden Stellen deines bisherigen Projekts. Die Supabase-Konfiguration und die Tabellen ändern sich nicht.

## Bedienung

- Einmal auf einen belegten Kalenderslot tippen: Kleiner Kartenfächer öffnet sich direkt am Slot, der übrige Kalender wird abgedunkelt. Jede Karte zeigt Modul/Inhalt, Lehrperson, Raum, Datum und Uhrzeit.
- Inaktive Alternativen erscheinen in **neutralem Grau** ohne Modulfarbton, sowohl im Kalender als auch im Fächer. Aktive Gruppen behalten ihre Modulfarbe.
- Eine alternative Karte auswählen: Zwischen *Wechseln* oder *Beide besuchen* wählen und anschließend *einmalig* oder *ab jetzt* bestätigen.
- Eine aktive Karte auswählen: Besuch einmalig oder für die Zukunft aussetzen, ohne die Reihe zu löschen.
- Bei einem einmaligen Wechsel oder Aussetzen: *Einmalige Wahl zurücknehmen* stellt die vorherige Auswahl wieder her; auch ein zuvor verdrängter anderer Kurs wird wieder angezeigt.
- Zweimal schnell auf die Karte tippen: Termin bearbeiten. Über *Bearbeiten* ist diese Funktion auch ohne Doppeltipp erreichbar.
- Nur die oberste aktive Karte lange drücken und ziehen: Einzeln an eine andere Zeit verschieben. Beim Loslassen nach dem Zeitraum fragen. Der restliche Fächer bleibt unverändert.
- Wirklich löschen: In **Module → Veranstaltung → Gruppe bearbeiten → Gruppe löschen** wird nur diese feste Veranstaltungsreihe vollständig entfernt. In anderen Termindetails gibt es ebenfalls eine gesonderte Bestätigung für das endgültige Löschen.
- Einmalig verschieben oder aussetzen: keine neue Reihe und keine neue Alternative; nur ein datierter Ausnahme-Eintrag an derselben ID.

## Wichtige Unterschiede

**Aussetzen** = persönlicher Besuch ausgeschaltet, die Gruppe bleibt im Katalog und kann später wieder gewählt werden. **Wechseln** = Auswahlentscheidung zwischen bestehenden Gruppen, niemals ein geklonter Termin. **Gruppe löschen** = echte Veranstaltungsreihe aus Kalender und Modul entfernen, keine automatische Wiederherstellung.

Ältere bereits vorhandene Gruppen-Duplikate werden **nicht automatisch bereinigt**, da sich echte Angebote von früheren Kopien nicht immer sicher unterscheiden lassen. Sie können in der Modulübersicht manuell entfernt werden.

## Vor dem Testen

1. Backup deiner persönlichen UniFlow-Daten erstellen (Mehr → Backup herunterladen).
2. Update-ZIP in deinen vorhandenen Projektordner kopieren. `.env.local` behalten.
3. Vite neu starten: `npm run dev -- --host 0.0.0.0`.
4. Auf dem iPhone einmalig zwischen VL 01 bei Winkert und Narben wechseln, die Wahl zurücknehmen, aussetzen und die Karte in einen anderen Slot ziehen.

## Prüfung

Die Modelltests in `npm test` einschließlich der neuen `test-v071.cjs` wurden ausgeführt. TypeScript/JSX-Syntax wurde unabhängig transpiliert und CSS geparst. Ein vollständiger Vite-Browser-Build und ein physischer iPhone-Touchtest waren in der Arbeitsumgebung mangels installierbarer npm-Pakete **nicht möglich**. Bitte Verhalten auf dem Gerät prüfen.
