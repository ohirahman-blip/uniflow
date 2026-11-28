# UniFlow – Designkatalog

Jedes native Bedienfeld erhält im JSX eine feste Kennung, beispielsweise `data-ui="button-1"`. Bei zukünftigen Änderungen zuerst den passenden Typ wiederverwenden. Farben, Schrift, Rahmen, Rundung und Interaktion der Standardtypen werden in `src/ui-controls.css` gepflegt; funktionsbezogene Anordnung (Grid, Breite, Abstände zum nächsten Element) bleibt beim jeweiligen Bildschirm. `src/ui-special-controls.css` enthält die übernommenen Designs der besonderen Bedienelemente. `src/module-directory.css` enthält die Kurskarten und Modulfilter samt ihrer responsiven Anordnung.

## Grunddesign

| Eigenschaft | Dunkel | Hell |
| --- | --- | --- |
| Hintergrund | `#0b0b0c` | `#ffffff` |
| Fläche | `#151517` | `#f4f4f6` |
| Bedienfeld | `#232327` | `#ededf0` |
| Text | `#f4f4f5` | `#202126` |
| Sekundärtext | `#929299` | `#6d6e75` |
| Hauptbutton | `#e3e3e7`, dunkler Text | `#303139`, weißer Text |

Verbindliche Vorlagen sind die ursprüngliche Kalenderleiste, „+ Aufgabe“, die Modulaktionsbuttons sowie Prüfungen und Lernplan vor dem Designumbau. Aeonik Pro, kompakte Buttons mit 36 px, Felder mit 42 px, Kapseln oder dezente runde Icons. Sekundäraktionen sind dunkel transparent und hell dezent grau. Hauptaktionen bleiben mit 48 px gut erreichbar. Keine dekorativen Schatten oder Blur-Effekte auf Standardcontrols. Fokus bleibt sichtbar; alle Zustände berücksichtigen Hell und Dunkel.

## Buttons

| Typ / Kennung | Gestaltung | Verwendung |
| --- | --- | --- |
| Button 1 – `button-1` | Kontrastreiche Fläche, 48 px Mindesthöhe, Radius 14 px, kräftige Schrift | Hauptaktion, Speichern, Weiter |
| Button 2 – `button-2` | Vorlage „+ Aufgabe“: 36 px, Radius 18 px, dunkel transparent, hell dezent grau, 12-px-Schrift | Nebenaktionen |
| Button 3 – `button-3` | Transparent, dezente Textfarbe, 36 px | Textaktionen und Zurück |
| Button 4 – `button-4` | Vorlage Kalender: Kreis, 36 × 36 px, 17-px-Icon, dezente Fläche | Schließen, Pfeile, kleine Werkzeuge |
| Button 5 – `button-5` | Transparent, dezente rote Schrift; nur bei Hover leicht getönt | Löschen und gefährliche Aktionen |
| Button 6 – `button-6` | Vorlage Modulaktionen: kompakte Kapsel, 36 px, schwache Flächentönung | Hinzufügen, kurze Aktionen |
| Button 7 – `button-7` | Frühere Kalenderwerkzeuge: rund, 36 px (mobil 33 × 34 px), dezente Fläche; Heute als transparenter Text in der Leiste | Kalenderleiste, Fokus, Navigation |
| Button 8 – `button-8` | Früherer „+ Aufgabe“-Button: 12-px-Schrift, 8 × 13 px Innenabstand, Radius 18 px; dunkel transparent, hell dezent grau | Kompakte Hinzufügen-Aktion im Dashboard |
| Button 9 – `button-9` | Früherer Papierkorb: freistehendes dezentes Icon ohne gefüllten Kreis, 16 px | Aufgaben löschen; kompakte 30-px-Variante im Lernbereich |
| Button 10 – `button-10` | Ziele: mobil zunächst runder 40-px-Iconbutton, bei Auswahl expandiert er mit dem Text „Ziele“; am Desktop abgerundetes Rechteck mit Icon und Text | Eigener Ziele-Bereich neben der Modulfilterleiste in Lernen, ohne zusätzliche Überschrift |

## Felder und Dropdowns

| Typ / Kennung | Gestaltung | Verwendung |
| --- | --- | --- |
| Feld 1 – `field-1` | 42 px, Radius 12 px, rahmenlose dezente Fläche | Einzeilige Eingabe, Suche |
| Feld 2 – `field-2` | Mehrzeilig, mindestens 100 px, Radius 14 px, kein manuelles Ziehen | Notizen; kompakte automatisch wachsende Schnelleingabe |
| Feld 3 – `field-3` | Transparente Fläche ohne Rahmen oder Unterlinie, Titelgröße 24–36 px | Großer Eingabetitel |
| Feld 4 – `field-4` | Zentrierte 24-px-Ziffern, Tabellarziffern, Standardfläche | Uhrzeit und Dauer |
| Dropdown 1 – `dropdown-1` | Wie Feld 1, Inhalt links, Pfeil rechts | Native Auswahl oder Auslöser des UniFlow-Pickers |

Dropdowns und Textfelder haben keinen dauerhaften Rahmen. Für Tastaturbedienung bleibt ein sichtbarer Fokus. Auch Suchfeld-Hüllen und kompakte Aufwand-Dropdowns im Lernplan verwenden rahmenlose Flächen. `form-controls.css` verweist für die alten Feldvariablen auf die zentralen Tokens.

## Auswahlfelder

| Typ / Kennung | Gestaltung | Verwendung |
| --- | --- | --- |
| Auswahl 1 – `select-1` | Kompakte 36-px-Kapsel, transparent, aktive Akzenttönung | Tabs, Wiederholungen, Ansichten |
| Auswahl 2 – `select-2` | Breite Zeile, Inhalt links, optional Zusatzinfo rechts, Radius 12 px | Dropdown- und Menüoptionen |
| Auswahl 3 – `select-3` | Checkbox bzw. transparente Kontrollzeile mit Häkchen | Erledigt, Teilnahme |
| Auswahl 4 – `select-4` | 48 × 28 px, Kapsel mit rundem 22-px-Schieber | An/Aus |
| Auswahl 5 – `select-5` | Farbflächen bzw. Farbpunkte | Modulfarbe |
| Auswahl 6 – `select-6` | Kompakte Kalendertage, sichtbarer ausgewählter Tag | Datumsauswahl |
| Auswahl 7 – `select-7` | Vertikale Auswahlzeilen in der Scrollrolle | Uhrzeit/Dauer per Scrollen |
| Auswahl 8 – `select-8` | Kompakte Bewertungssegmente, Statusfarbe | Lernfeedback |
| Auswahl 9 – `select-9` | Vorlage Kalenderleiste: 34-px-Kapseln mit kontrastreicher Auswahl; mobil Icons, aktives Segment wächst mit Text | Aktuelle, vergangene, geplante und alle Module |
| Auswahl 10 – `select-10` | Frühere Kalenderansicht: kompakte 34-px-Kapseln, aktive Auswahl kontrastreich gefüllt | Tag, zwei Tage, Woche und Monat |

## Funktionsgebundene Sondertypen

`plan-1` ist die ursprüngliche Vorlage für Prüfungen und Lernplan: schmale Zeitstrahleinträge, kleine Lernaktionen, 11-px-Tabs in einer gemeinsamen Kapsel und kompakte Aufwand-Auswahl. `action-1` ist die ursprüngliche Modulaktion mit Icon und aufklappender Beschriftung. Beide werden zentral in `src/ui-plan-controls.css` gepflegt; ihre besonderen Maße werden nicht durch Standardbuttons ersetzt. Zeitstrahl, Inhalt und Bedienlogik bleiben in den jeweiligen Komponenten.

Die Sondertypen behalten unterschiedliche Inhaltslayouts und ihre dazugehörigen Zustände. Sie sind Familien, keine vollständig identischen Standardbuttons.

| Typ / Kennung | Gestaltung / Aufbau |
| --- | --- |
| Spezial 1 – `special-1` | Kurskarte mit Cover und nach unten dunkler werdendem Verlauf; Modulname, Modulfarbe. 104 px hoch, mobil 92 px, 2–4 Spalten. Geplante Module in der Gesamtübersicht grau. |
| Spezial 2 – `special-2` | Bildfläche mit Upload-Auslöser für das Modulcover |
| Spezial 3 – `special-3` | Kalendersteuerung und Kalenderzellen; Datum, Auswahl und Ereignisfarben |
| Spezial 4 – `special-4` | Score- und Streak-Anzeigen im Lernbereich mit eigener Zahlentypografie |
| Spezial 5 – `special-5` | Navigation, App-Marke und Modul-Kurzleiste mit Symbolen |
| Spezial 6 – `special-6` | Inhaltsreiche Eintragskarten, Modul-/Profilzeilen und Lernplanzeilen |
| Spezial 7 – `special-7` | Anmeldecode; Eingabe über vorhandene Ziffernmaske |
| Datei 1 – `file-1` | Verdeckte technische Dateieingabe; sichtbarer Auslöser ist ein Button oder Bildfeld |

Neue Standardvarianten nur dann ergänzen, wenn kein vorhandener Typ passt. Neue Sondertypen erhalten eine eigene Kennung und werden hier beschrieben. Fachliche Zustände, Datenspeicherung und Anmeldeabläufe bleiben in den jeweiligen Komponenten.
