> **Neu in 0.7:** Siehe [UPDATE-0.7.md](UPDATE-0.7.md) für die Modul-Detailseiten, sichtbare alternative Veranstaltungen und die neue Gruppenverwaltung.

# UniFlow 0.6 — Studienplaner mit verknüpften Alternativen

Dieses Projekt baut auf **UniFlow 0.5 mit achtstelligem E-Mail-OTP** auf. Das bestehende schwarze Onboarding und die Cloud-Authentifizierung bleiben. Kein Code aus dem bisherigen Projekt muss von Hand neu geschrieben werden.

## Schnellstart auf dem Mac

1. Projektordner `uniflow-prototyp` in VS Code öffnen.
2. Die `.env.local` enthält bereits **deine mitgeteilte Supabase-Projektadresse und deinen öffentlichen Publishable Key**. Nur ändern, wenn du später das Supabase-Projekt wechselst. `.env.local` nicht in ein öffentliches Git-Repository hochladen; **niemals einen `service_role`- oder `sb_secret_`-Key ins Frontend eintragen**.
3. `npm install` und `npm run dev -- --host 0.0.0.0` ausführen.
4. Mac: Vite-Local-Adresse öffnen. iPhone: Vite-Network-Adresse im selben WLAN aufrufen. Die Seite nutzt weiterhin den 8-stelligen E-Mail-Code aus dem bereits verbundenen Supabase-Auth-System.

Wenn du nur die geänderten Dateien einspielst, vorher deine bestehende Projektkopie bzw. eine JSON-Sicherung behalten. Das kleine Update-ZIP enthält auch `.env.local`, wie gewünscht. **Falls du in deinem bestehenden Projekt andere Supabase-Zugangsdaten nutzt, diese Datei nicht überschreiben.**

## Einmalig: Admin-E-Mail-Suche aktivieren

**Nur für diese neue Funktion** muss der SQL Editor erneut verwendet werden. Deine bisherige Migration wird nicht gelöscht oder neu aufgesetzt:

1. Supabase Dashboard → SQL Editor.
2. Inhalt von `supabase/migrations/20261011_uniflow_admin_accounts.sql` einfügen und **Run** drücken.
3. Dein eigener Account muss wie bisher eine Admin-Rolle in `public.user_roles` haben. Für den allerersten Admin kannst du nach deinem erfolgreichen Login in **Authentication → Users** die UUID kopieren und im SQL Editor ausführen:

```sql
insert into public.user_roles (user_id, role)
values ('DEINE-ECHTE-USER-UUID', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

4. UniFlow abmelden und neu anmelden. Unter **Admin** werden jetzt **E-Mail-Adresse, Registrierungsdatum und Premiumstatus** statt einer sichtbaren User-ID angezeigt. Suche nach E-Mail ist möglich. `uniflow+` ist die Premiumkennzeichnung.

**Datenschutz:** Das neue Admin-RPC ist nur für angemeldete Nutzer mit der durch RLS/SQL geprüften Admin-Rolle verfügbar. Es liefert niemals Studiengang, Noten, Kalender, Module oder den privaten Workspace. Betreiber mit vollständigen Datenbank-/Projektownerrechten bleiben technisch weiterhin privilegiert.

## Kalender 0.6

- **Alternative Gruppen und Zeitslots:** Alle Termine sind echte Termindatensätze, mit eigenem Datum, Rhythmus, Uhrzeit, Raum, optionalem Veranstalter und Bearbeitung/Löschung. Gleichwertige Gruppen teilen eine inhaltliche Kennung; alle anderen zur selben Zeit liegen automatisch als Zeit-Alternative vor. Ein Termin kann gleichzeitig in beiden Gruppen vorkommen.
- **Automatisches Alternativangebot:** Einen neuen normalen Termin mit Überschneidung hinzufügen → der neue Termin wird zunächst nicht als Haupttermin, sondern als Alternative gespeichert. Ein gewählter Haupttermin wird beim Gruppenwechsel ebenfalls zur Alternative, statt endgültig zu verschwinden. Beim Wechsel zu einer belegten Zeit wird der bisherige Termin an dieser Zeit als Alternative behalten.
- **Wechselumfang:** „Nur dieses Mal“ oder „Ab jetzt und zukünftig“. Vergangene Termine bleiben erhalten. Ein zweiwöchentlicher Ersatz erzeugt keine leeren Zwischenwochen: Der alte wöchentliche Termin bleibt in Wochen ohne Ersatz bestehen.
- **Löschen:** „Dieser und alle zukünftigen“ löscht einschließlich der ausgewählten Veranstaltung. Beim Entfernen lassen sich verknüpfte Alternativen als Ersatz auswählen.
- **Listen und Darstellung:** Fließendere Swipe-Logik mit Zurück/Vorwärts-Pfeilen, feste Stundenleiste, aktuelle Uhrzeitlinie, bereits beendete Veranstaltungen in Graustufen. Kleine Symbolbuttons für Tag / 2 Tage / Woche und Fokus oben rechts.
- **Wochenenden:** In Einstellungen wählbar: Mo–Fr, Mo–Sa oder Mo–So. Aktive Termine/Prüfungen am Wochenende erweitern die jeweilige Woche automatisch; sonst verschwinden diese Tage aus der Wochenansicht.
- **Klausur und Hausaufgabe:** Über das Plus im Kalendertoolbar hinzufügen. Die Kategorie erhält ein kleines Symbol in der Veranstaltungskarte; bevorstehende Klausuren werden als Countdown auf dem jeweiligen Modul angezeigt.
- **Modulverwaltung:** Ruhige Karten, acht statt sechzehn Farbtöne, keine Emojivorschläge. Ein Emoji ist freiwillig und kann leer gelassen werden.
- **Einstellungen:** Dunkel und hell, Semester-Verwaltung und bestehende Supabase-Synchronisierung.

### Bekannte Grenzen

- Der Termineditor bietet für **verknüpfte Alternativen** Verschieben als Bearbeitung von Datum und Uhrzeit; langes Drag-and-drop im Kalender bleibt für die sichtbaren Haupttermine.
- Kalenderwochen werden nur in der Wochenansicht standardmäßig verkürzt. In Tag-/2-Tage-Ansicht kannst du weiterhin zu jedem Datum navigieren.
- Bei sehr vielen Terminen oder gleichzeitigem Bearbeiten auf zwei Geräten gibt es noch keine serverseitige Konfliktauflösung. Vor dem Update bitte eine Sicherung exportieren.
- Die Projekt-PWA ist noch keine native App. Apple-Anmeldung braucht weiterhin eine Apple-Developer-Konfiguration; E-Mail-OTP ist jetzt der funktionierende Anmeldeweg, sofern SMTP und Supabase korrekt eingerichtet sind.

## Tests

`npm test` führt die bisherigen 18 Kalenderassertions und 29 neue Assertions der Alternativlogik aus. Auch `npm run build` sollte nach `npm install` ausgeführt werden.

**Hier in der Erstellungsumgebung** konnten der Parser, statische Quellcodeprüfung mit Ersatztypen, CSS und die Kalenderberechnung geprüft werden. Ein echter React-Build und iPhone-/Supabase-Livetest waren wegen fehlender herunterladbarer npm-Pakete nicht möglich. Teste insbesondere die langen Gesten und die Darstellung auf deinem iPhone; bei Fehlern bitte den genauen Konsolenfehler schicken.
