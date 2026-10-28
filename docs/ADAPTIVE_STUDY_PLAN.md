# Adaptiver Lernplan

Der Lernplan arbeitet lokal und deterministisch, ohne KI und ohne automatische Kalendereinträge.

## Bedienung

- Profil → Einstellungen → Lernplan: Lerntage, früheste/späteste Lernzeit und einzelne freie Tage. Kein Tagesbudget. Alte Minuten-pro-Tag-Werte bleiben kompatibel gespeichert, werden aber nicht verwendet.
- Leicht = 30, Mittel = 60, Schwer = 120 Minuten als reine Planungsschätzung pro vollständiger Aufgabe. Wiederholungen haben denselben Richtwert.
- Dashboard: heutige Tagespakete aller Module; mehrere Stoffeinheiten eines Moduls werden pro Tag in einem Banner zusammengefasst.
- Lernen → Dein Semester im Blick → Lernplan: eigener Stoff, Datum links, komprimierte freie Intervalle und kräftigere Modulfarbe Richtung Prüfung.
- Prüfungsstoff: Relevanz-Checkboxen und Schwierigkeitswahl. Gefestigter Stoff ist separat einklappbar. Wieder einplanen verändert keine Striche und keine Punkte.
- Kalender: wenige dezente, ausblendbare Vorschläge. Ein Hinweis muss eine vollständige Aufgabe in einer realen Lücke unterbringen können; er zerlegt sie nicht. X blendet ihn zwei Stunden aus, ohne die Aufgabe zu löschen.

## Berechnung

Alle offenen, ausgewählten Prüfungen aktueller, sichtbarer Module des Studiengangs werden berücksichtigt. Letzter Lerntag ist der Tag vor der Prüfung, maximal zwölf Monate Planung. Ohne Prüfungstermin wird vorsichtig für zwei Wochen auf zwei der gewählten Wochentage geplant.

Der Plan verteilt vollständige Aufgaben möglichst früh, in der tatsächlichen Veranstaltungsreihenfolge (Datum, Uhrzeit, stabiler Schlüssel), statt alle Vorlesungen vor alle Übungen zu setzen. Er behauptet keine fachliche Zuordnung zwischen Übung und Vorlesung. Künftiger Stoff wird erst nach der Veranstaltung gelernt.

Es gibt kein frei eingestelltes Tageskontingent und keine 15-Minuten-Zuteilung. Die Minuten dienen als Gewicht, um umfangreiche Aufgaben über die Lerntage zu verteilen und Wiederholungspuffer freizuhalten. Physische Kalenderbelegung wird weiterhin berücksichtigt: eine vollständige Aufgabe muss in ein freies Fenster passen. Veranstaltungen haben zehn, Prüfungen fünfzehn Minuten Puffer; undatierte Uhrzeit einer Prüfung blockiert vorsichtshalber den Lerntag. Erfasste Lernzeit belegt real verfügbare Zeit, verkleinert aber keine Aufgabe.

Erforderliches Lernen kommt vor optionalen Wiederholungen, frühere Prüfungsfristen zuerst:
- Noch nicht gelernt / nicht verstanden: ein vollständiger Lerndurchgang, zunächst mit erwarteter teilweiser Verständlichkeit (Planungsziel 2, kein echter Fortschritt).
- Anschließend ein vollständiger Vertiefungsblock normalerweise drei Tage später, bei naher Prüfung nötigenfalls am nächsten Lerntag.
- Tatsächlich teilweise verstanden: direkt einen vollständigen Vertiefungsblock einplanen.
- Gut verstanden: nur eine Wiederholung mit Abstand (mindestens drei Tage zur letzten Session). Sie darf in Engpässen entfallen.
- Nach geplanter Vertiefung folgt optional eine volle Wiederholung frühestens sieben Tage später.
- Vier grüne Striche: keine weiteren Aufgaben, außer ausdrücklich wieder eingeplant.

Neueste Rückmeldung, nicht die Minuten, entscheidet über echte Striche: offen = 1, teilweise = 2, gut = 3; zwei aufeinanderfolgende gute Rückmeldungen = 4. Eine schlechtere Rückmeldung setzt die gute Serie zurück. Gelbe Besuchsstriche, verdiente Punkte und Verlauf bleiben unverändert. Neuberechnung bei Rückmeldungen, Änderungen, Wiederöffnen und Tageswechsel ersetzt die vorsichtigen Annahmen durch den aktuellen Stand.

Kann erforderliches Lernen nicht vollständig vor der Prüfung untergebracht werden, erscheint im Modul ein Hinweis statt stiller Zerstückelung. Ein unzureichender Kalenderslot erzeugt keinen Teilblock.

## Daten und Tests

Keine Datenbankmigration oder Löschung vorhandener Daten. Erfasste Sessions bleiben erhalten; die letzten vierzehn Tage erscheinen zusätzlich als abgeschlossene Tagespakete. Einstellungen liegen optional im bestehenden Workspace-JSON unter studySchedule.

npm run test:study-plan und node test-lesson-progress.cjs prüfen vollständige Blöcke, identische Wiederholungsdauer, ignoriertes altes Tagesbudget, zeitigen Beginn, Abstände, Kalenderreihenfolge, Rückmeldungen, enge Prüfungen, Lerntage, Ferien, fehlende Termine, ausgeschlossenen/gefestigten Stoff, echte Kalenderlücken, Neuberechnung und Datenunveränderlichkeit.
