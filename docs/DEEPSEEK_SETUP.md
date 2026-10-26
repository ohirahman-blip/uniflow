# KI-Empfehlungen und Schnelleingabe

Die bestehende Supabase-/DeepSeek-Anbindung und das Premium-Modell bleiben erhalten.
Ein Git-Push/Vercel-Deployment allein aktualisiert keine Supabase-Datenbank oder Edge Functions.

## Update von der gemeinsamen 25-Anfragen-Grenze

1. Im Supabase SQL Editor einmal die neue Migration ausführen:
   `supabase/migrations/20261027_uniflow_ai_cache.sql`.
   Bestehende Module, Bewertungen, Empfehlungen anderer Systeme und die alte Quota-Tabelle werden nicht gelöscht.
2. Beide Funktionen aus diesem Stand mit Supabase CLI bereitstellen:
   ```sh
   supabase login
   supabase link --project-ref DEIN_PROJECT_REF
   supabase functions deploy uniflow-ai-advice
   supabase functions deploy uniflow-ai-schedule
   ```
   Der CLI-Bundler nimmt `supabase/functions/_shared/advice-policy.ts` für die Empfehlung mit.
   JWT-Prüfung nicht deaktivieren.
3. Web-App aus `main` aktualisieren. Bestehendes `VITE_UNIFLOW_AI_ENABLED=true` bleibt bestehen.
   In **Profil → Einstellungen → KI-Modus** wird die Zustimmung gegeben; nur Premium-Konten können echte KI-Aufrufe starten.

**Reihenfolge wichtig:** erst SQL, dann beide Funktionen, dann Web-App.
Die neue Web-App startet ohne Cache-Migration keine alten 25/Tag-Empfehlungsaufrufe.
Bis auch `uniflow-ai-schedule` aktualisiert wurde, verwendet die alte Schnelleingabe weiterhin ihr bisheriges Limit.

## Dashboard-Empfehlung

- Ein kontoabhängiger Supabase-Cache speichert die letzte erfolgreiche Empfehlung, Kontext-Signatur und Erstellzeit.
- Geräte und Browser-Tabs lesen denselben Stand. Zusätzlich gibt es einen benutzerspezifischen lokalen Cache für schnelle/offline Anzeige.
- Dashboard öffnen oder App in den Vordergrund bringen liest zunächst den gespeicherten Stand. Das ist **kein Modellaufruf**.
- Relevante Änderungen: neue/geänderte/entfernte Lernsessions, Verständnis/Besuch, gelernter Stoff, Termine und Prüfungen. Profil-, Design- und Timer-Anzeigeänderungen lösen keine Neubewertung aus.
- Neu berechnen bei relevant verändertem Kontext **frühestens 30 Minuten** nach dem letzten erfolgreichen Ergebnis.
- Bei unverändertem Kontext erst nach **4 Stunden**.
- Nur ein sichtbares Dashboard ohne darüberliegendes Profil aktiviert die Prüfung. Keine periodischen Anfragen, kein Hintergrundjob und kein Nachholen geschlossener Zeiträume.
- Zwei Geräte werden atomar durch eine Datenbank-Zeilensperre und eine **60-Sekunden-Reservierung** zusammengeführt. Nur ein Serveraufruf darf eine kostenpflichtige Generierung starten.
- Bei Fehlern bleibt die letzte erfolgreiche Empfehlung samt Zeitstempel sichtbar. Die Server-Wartezeit steigt auf **5 Minuten**, **15 Minuten**, dann **1 Stunde**. Ein Neustart oder Umschalten des KI-Modus umgeht die Sperre nicht.
- Der Browser hat zusätzlich eine 5-Minuten-Pause bei Netzwerk-/Konfigurationsfehlern. Manuelle Browser-Aktualisierungen können deshalb keine Modellaufruf-Schleife auslösen.
- Die interne einmalige Antwortformat-Wiederholung bleibt erhalten, falls DeepSeek leere/ungültige JSON-Antworten liefert. Eine Generierung kann deshalb höchstens zwei Anbieteraufrufe umfassen.
- Es gibt für diese neue Regelung keinen gemeinsamen 25/Tag-Zähler mehr. Die alte Quota-Funktion bleibt ausschließlich für Rollback/alte Deployments bestehen.

## KI-Schnelleingabe

- Kein festes Tageslimit.
- Atomarer, geräteübergreifender Schutz: höchstens ein Start pro Konto innerhalb von **15 Sekunden**.
- Unverändert: begrenzter Eingabetext, Prüfung von Anmeldung/Premium, erlaubte Origins, Server-Timeout und geprüfte strukturierte Vorschläge.
- Vorschläge werden weiterhin erst nach bewusster Übernahme in den Stundenplan geschrieben.
- Die Schnelleingabe verändert nicht den Dashboard-Cache und verbraucht kein Empfehlungskontingent.

## Secrets und Datenschutz

- `DEEPSEEK_API_KEY` gehört ausschließlich in Supabase Edge Function Secrets. Niemals in `VITE_...`, Browsercode, Git oder Chat.
- `SUPABASE_SERVICE_ROLE_KEY` wird ausschließlich serverseitig verwendet. Hosted Supabase stellt die Standard-Projektvariablen bereit; bei lokaler Funktionsentwicklung entsprechend konfigurieren.
- Die Funktionen prüfen zuerst das echte Nutzer-JWT und das adminverwaltete `account_directory.premium`. Erst danach verwendet der Server seinen privilegierten Client.
- Schreibzugriff und Reservierungs-RPCs sind nur für `service_role` freigegeben. Angemeldete Premium-Nutzer können durch RLS ausschließlich ihre eigene gespeicherte Empfehlung lesen; keine fremden Daten oder Lease-Tokens.
- Nur ein kleiner, begrenzter Studienkontext wird an den Anbieter geschickt. Ein lokaler Lernfortschritt-Fingerabdruck dient nur der Aktualisierungserkennung; vollständige Lernsessions werden nicht an DeepSeek übertragen.
- `UNIFLOW_ALLOWED_ORIGINS` und bestehendes `DEEPSEEK_MODEL` bleiben unverändert. Kein Provider-/Modellwechsel durch dieses Update.

## Prüfung ohne kostenpflichtige KI-Aufrufe

`npm run build` prüft die Web-App. Die reine Aktualisierungslogik kann mit
`npm run test:ai-cache` geprüft werden. Diese Prüfung ruft keine API auf.
Die Live-Datenbank, RLS und Edge Deployments müssen nach Bereitstellung separat geprüft werden.

Offizielle Supabase-Anleitungen:
- [Datenbankfunktionen](https://supabase.com/docs/guides/database/functions)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Edge Functions deployen](https://supabase.com/docs/guides/functions/deploy)
- [Server-Secrets](https://supabase.com/docs/guides/functions/secrets)
