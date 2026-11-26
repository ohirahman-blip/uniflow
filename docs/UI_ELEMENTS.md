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

Aeonik Pro, Standardhöhe 48 px, kompakte Höhe 40 px, Standardradius 14 px. Standardbedienelemente verwenden keine Schlagschatten oder Blur-Effekte. Hover ändert die Farbe, ohne das Element anzuheben. Auswahlzustände nutzen die Modul- bzw. App-Akzentfarbe; Fokus per Tastatur erhält einen sichtbaren Rahmen. Sonderbereiche können eigene funktionale Maße und Zustände benötigen.

## Buttons

| Typ / Kennung | Gestaltung | Verwendung |
| --- | --- | --- |
| Button 1 – `button-1` | Kontrastreiche Fläche, 48 px Mindesthöhe, Radius 14 px, kräftige Schrift | Hauptaktion, Speichern, Weiter |
| Button 2 – `button-2` | Neutrale Fläche, 48 px, Radius 14 px | Nebenaktionen |
| Button 3 – `button-3` | Transparent, dezente Textfarbe, 40 px | Textaktionen und Zurück |
| Button 4 – `button-4` | Kreis, 40 × 40 px, meist 18-px-Icon | Schließen, Pfeile, kleine Werkzeuge |
| Button 5 – `button-5` | Dezent rot getönte Fläche, rote Schrift, Radius 14 px | Löschen und gefährliche Aktionen |
| Button 6 – `button-6` | Kompakte Kapsel, 40 px, schwache Flächentönung | Hinzufügen, kurze Aktionen |

## Felder und Dropdowns

| Typ / Kennung | Gestaltung | Verwendung |
| --- | --- | --- |
| Feld 1 – `field-1` | 48 px, Radius 14 px, feiner Rahmen und neutrale Fläche | Einzeilige Eingabe, Suche |
| Feld 2 – `field-2` | Mehrzeilig, mindestens 100 px, Radius 14 px, kein manuelles Ziehen | Notizen; kompakte automatisch wachsende Schnelleingabe |
| Feld 3 – `field-3` | Transparente Fläche, Unterlinie, Titelgröße 24–36 px | Großer Eingabetitel |
| Feld 4 – `field-4` | Zentrierte 24-px-Ziffern, Tabellarziffern, Standardfläche | Uhrzeit und Dauer |
| Dropdown 1 – `dropdown-1` | Wie Feld 1, Inhalt links, Pfeil rechts | Native Auswahl oder Auslöser des UniFlow-Pickers |

## Auswahlfelder

| Typ / Kennung | Gestaltung | Verwendung |
| --- | --- | --- |
| Auswahl 1 – `select-1` | Kompaktes Segment, Radius 12 px, aktive Akzenttönung | Tabs, Wiederholungen, Ansichten |
| Auswahl 2 – `select-2` | Breite Zeile, Inhalt links, optional Zusatzinfo rechts, Radius 12 px | Dropdown- und Menüoptionen |
| Auswahl 3 – `select-3` | Checkbox bzw. transparente Kontrollzeile mit Häkchen | Erledigt, Teilnahme |
| Auswahl 4 – `select-4` | 48 × 28 px, Kapsel mit rundem 22-px-Schieber | An/Aus |
| Auswahl 5 – `select-5` | Farbflächen bzw. Farbpunkte | Modulfarbe |
| Auswahl 6 – `select-6` | Kompakte Kalendertage, sichtbarer ausgewählter Tag | Datumsauswahl |
| Auswahl 7 – `select-7` | Vertikale Auswahlzeilen in der Scrollrolle | Uhrzeit/Dauer per Scrollen |
| Auswahl 8 – `select-8` | Kompakte Bewertungssegmente, Statusfarbe | Lernfeedback |
| Auswahl 9 – `select-9` | Abgerundete Filterleiste; mobil Icons, aktives Segment wächst mit Text | Aktuelle, vergangene, geplante und alle Module |

## Funktionsgebundene Sondertypen

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
