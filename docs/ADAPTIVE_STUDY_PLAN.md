# Adaptiver Lernplan

Der Lernplan arbeitet vollständig lokal und deterministisch. Er nutzt weder KI noch Netzwerkaufrufe und schreibt keine automatisch erzeugten Termine in den Kalender.

## Bedienung

- Profil → Einstellungen → Lernplan: Lerntage, gemeinsames Tagesbudget, früheste/späteste Lernzeit und einzelne freie Tage.
- Standard: täglich bis zu 60 Minuten zwischen 09:00 und 20:00 Uhr. Diese Zeiten begrenzen mögliche Lernfenster, nicht feste Termine.
- Dashboard: heutige Tagespakete aller Module, mit direktem Einstieg in „Stoff gelernt“.
- Lernen → „Dein Semester im Blick“ → „Lernplan“: vollständige, nach Monaten gruppierte Tagespakete des gewählten Moduls. Die Prüfungsansicht bleibt als Vergleich über alle Module erhalten; die Lernplanansicht zeigt nur eigene Prüfungen.
- „Lernen“ öffnet „Stoff gelernt“ mit vorausgewähltem Stoff. Auch ein zukünftiges Paket kann freiwillig früher bearbeitet werden.
- „Prüfungsstoff & Aufwand“: Stoff je Prüfung ausschließen und Aufwand je Einheit anpassen. Leeres Minutenfeld bedeutet automatische Schätzung.
- Kalender: höchstens drei Hinweise je Woche bzw. zwei je Tag in Tages-/Zwei-Tage-Ansicht. Ein X blendet den Hinweis für dieses Modul und diesen Tag zwei Stunden lang aus. Der Tagesplan bleibt unverändert.

## Berechnung

Die Eingaben sind Workspace-Daten und das lokale Tagesdatum. Eine Neuberechnung erfolgt beim Tageswechsel, Wiederöffnen sowie relevanten Änderungen an Prüfungen, Veranstaltungen, Lernfortschritt oder Einstellungen. Die Berechnung ist memoisiert.

Alle gewählten, offenen Prüfungen aktueller/nicht ausgeblendeter Module des aktiven Studiengangs konkurrieren um ein gemeinsames Tagesbudget. Der letzte Lerntag ist der Tag vor der Prüfung. Ohne Prüfungsdatum gibt es eine vorsichtige Zwei-Wochen-Planung. Der Berechnungshorizont ist auf zwölf Monate begrenzt.

Künftiger Stoff wird frühestens nach Ende seiner Veranstaltung berücksichtigt. Kalendertermine und Prüfungen werden als belegte Zeit behandelt, einschließlich zehn Minuten Puffer um Veranstaltungen und fünfzehn Minuten um Klausuren. Bei einer Klausur ohne Uhrzeit bleibt der Tag vorsichtshalber frei. Bereits eingetragene Lernminuten werden vom Tagesbudget abgezogen, auch ohne Stoffzuordnung.

Zuerst wird Erstlern-Kapazität über die Prüfungsfristen hinweg gesichert. Danach werden Nacharbeit, gutes Verständnis und Wiederholung eingeplant. Nahe oder aufwendige Fächer bekommen mehr Priorität; weit entfernte Fächer mit geringer Belastung beginnen auf zwei der gewählten Wochentage. Innerhalb von vier Wochen vor der Prüfung wird diese frühe Begrenzung aufgehoben. Aufwand startet bei 30 Minuten und wird aus bisherigen stoffbezogenen Lernzeiten abgeleitet, begrenzt auf 15–120 Minuten. Manuelle Werte haben Vorrang.

Die Planung simuliert Lernschritte, verändert aber niemals tatsächliche grüne/gelbe Fortschrittsstriche oder Scores. Verständnis bleibt eine Rückmeldung des Nutzers, keine Garantie des Planers. Bei nicht ausreichender Erstlernzeit wird eine Warnung angezeigt; Tage werden nicht überbucht.

Erledigte Lerneinträge bleiben gespeichert; die Ansicht zeigt zusätzlich die letzten vierzehn Tage als abgeschlossene Tagespakete. Alte Workspace-Felder und bestehende Termine werden nicht gelöscht. Die neuen Einstellungen liegen optional in studySchedule im vorhandenen Workspace-JSON; keine Datenbankmigration erforderlich.

## Tests

npm run test:study-plan prüft Budgets, mehrere nahe Prüfungen, Lerntage/Urlaub, fehlende Termine, ausgeschlossenen Stoff, zusätzliches Lernen, künftige/späte/abgesagte Veranstaltungen, Überlastung, echte Kalenderlücken und deterministische Neuberechnung.
