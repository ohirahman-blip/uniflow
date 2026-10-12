# UniFlow 0.6.1 – gezieltes Darstellungs-Update

Basis: UniFlow 0.6. Unverändert bleiben `src/model.ts`, die Kalender-/Alternativlogik, Onboarding und alle übrigen Projektdateien.

## Installation (kleines ZIP)

1. Vorher in UniFlow unter Einstellungen ein Backup exportieren.
2. Das Update-ZIP in den vorhandenen Projektordner entpacken. Die Ordnerstruktur beibehalten; nur vorhandene gleichnamige Dateien ersetzen.
3. `.env.local` **nicht** überschreiben oder löschen. Das Update-ZIP enthält keine `.env.local`.
4. `npm run dev -- --host 0.0.0.0` neu starten und die Seite neu laden.
5. Supabase SQL Editor: `supabase/migrations/20261012_uniflow_admin_repair.sql` einmal ausführen; Voraussetzung ist die ursprüngliche `20261011_uniflow_core.sql`. Anschließend als Admin neu anmelden oder neu laden.

## Sichtbare Änderungen

- Einstellungs-Darstellung nur mit Mond-/Sonnensymbol; Sonne deaktiviert. Vorhandene `theme:'light'`-Speicherwerte werden **nicht gelöscht**, aber die App erzwingt vorläufig Dark Mode.
- Woche: Raum und Veranstalter unter dem Termin, bei wenig Platz mit Ellipse. Tag/2 Tage: maximal zwei Titelzeilen.
- Alternative-Terminlisten sind **beim Öffnen** sichtbar, können weiterhin zugeklappt werden; Standort/Veranstalter werden dort angezeigt.
- Keine versetzten Hintergrundkarten mehr bei Alternativen. Kleines, transparentes Alternativ-Symbol bleibt.
- Beim Öffnen eines Termins nur eine sichtbare Überschrift, kein doppelter Sheet-Titel. Desktop: oberes redundantes Einstellungen-Symbol entfernt.
- Weicher Übergang bei Ansichtswechsel und Navigationspfeilen, berücksichtigt „Bewegung reduzieren“.
- Premium-Logo `uniflow+` nutzt die Logofarben, wenn Supabase das Konto als `premium=true` führt (Status wird beim Login/Laden gelesen; bei Änderung gegebenenfalls Seite neu laden).
- Admin-Kontenliste und Studienkatalog laden unabhängig. Falls eine der beiden Abfragen scheitert, zeigt UniFlow die konkrete Fehlermeldung und einen „Erneut versuchen“-Button.

## Admin-Daten konnten nicht abgerufen werden?

1. Mit deinem eigenen Konto anmelden, dann unter Authentication → Users dessen UUID ermitteln.
2. In `public.user_roles` muss für diese UUID die Rolle `admin` stehen.
3. Die Datei `supabase/migrations/20261012_uniflow_admin_repair.sql` im SQL Editor ausführen. Sie erstellt/erneuert die geschützte RPC `uniflow_admin_accounts()`.
4. App neu laden. Steht weiterhin ein Fehler da, den **genauen** Text aus dem neuen Fehlerfeld prüfen; er kann von einer abweichenden DB-Konfiguration kommen.

Es werden keine geheimen Supabase-Schlüssel benötigt. Die Accountliste liefert nur E-Mail, Registrierungsdatum und Premiumstatus, nicht private Studien-/Kalenderdaten.

## Tests

- `node test-model.cjs` → 18 bestandene Assertions.
- `node test-v06.cjs` → 29 bestandene Assertions.
- TypeScript/JSX-Parsing und CSS-Parsing erfolgreich.
- Ein vollständiger Browser-Build war hier nicht möglich, da npm-Abhängigkeiten in dieser Arbeitsumgebung nicht im Cache liegen. Bitte die Animationen und die Adminabfrage auf dem Mac/iPhone testen.
