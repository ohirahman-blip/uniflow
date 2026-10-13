# DeepSeek für uniflow+ vorbereiten

Der neue Studienbegleiter ist **kein Chatbot**. Auf „Heute“ zeigt uniflow jederzeit
eine einzige situationsabhängige Empfehlung, z. B. eine kurze Wiederholung vor
der nächsten Vorlesung oder Klausurtraining bei einer nahenden Prüfung.

## Bereits ohne DeepSeek nutzbar
- Jede einzelne Vorlesung im Stundenplan öffnen: **Thema** eintragen und
  **Verstanden / Teilweise / Nicht verstanden / Nicht besucht** auswählen.
- Einschätzungen später jederzeit über dieselbe Terminoberfläche ändern.
- Vorlesungsthemen sind **pro Lehrwoche/Inhalt**, nicht für die ganze Reihe.
  Gleichwertige zeitliche Alternativen teilen sich das Thema einer Lehrwoche.
- „Heute“ berechnet aktuelle Empfehlungen lokal aus Terminen, vergangenen
  Bewertungen, offenen Rückmeldungen und Klausurfristen.
- Dieses lokale Verhalten funktioniert auch ohne Plus und ohne API-Key.

## Aktivierung, sobald du einen DeepSeek-Key hast

**Niemals** `DEEPSEEK_API_KEY` in `.env.local` als `VITE_...`, in `src/`,
auf GitHub, im Browser, in Vercel-Umgebungsvariablen oder im Chat hinterlegen.
Der Schlüssel gehört ausschließlich in **Supabase Edge Function Secrets**.

1. Die vorhandene Supabase-Instanz öffnen, das SQL aus
   `supabase/migrations/20261013_uniflow_ai_quota.sql`
   im Supabase **SQL Editor** einmal ausführen.
2. Supabase **Project Settings → Edge Function Secrets**:
   - `DEEPSEEK_API_KEY`: deinen geheimen DeepSeek-Schlüssel
   - optional `DEEPSEEK_MODEL`: standardmäßig `deepseek-flash`
   - optional `UNIFLOW_ALLOWED_ORIGINS`: kommaseparierte erlaubte Websites.
     Standard: `http://localhost:5173,http://127.0.0.1:5173,https://uniflow-jet.vercel.app`
3. Die Funktion **`supabase/functions/uniflow-ai-advice/index.ts`** in
   dein Supabase-Projekt deployen, z. B. über Supabase CLI:
   ```bash
   supabase login
   supabase link --project-ref DEIN_PROJECT_REF
   supabase functions deploy uniflow-ai-advice
   ```
   JWT-Überprüfung der Edge Function **nicht deaktivieren**.
4. Nur in der **lokalen** `.env.local` zusätzlich:
   ```dotenv
   VITE_UNIFLOW_AI_ENABLED=true
   ```
   Anschließend lokalen Vite-Server neu starten.
5. In Supabase muss der angemeldete Nutzer bereits mit
   `account_directory.premium=true` geführt werden (wie bisher durch
   Adminbereich / Admin-RPC). Die App prüft Plus im UI, der Server erneut.
6. Unter **Einstellungen → KI-Modus** als Plus-Nutzer den Regler einschalten.
   Das ist die bewusste Zustimmung zur Verarbeitung der angegebenen
   Lern- und Termininformationen durch DeepSeek. Der KI-Modus erscheint
   nur bei uniflow+-Konten. Auf „Heute“ gibt es dafür keinen Schalter.

Erst nach diesen Schritten werden echte DeepSeek-Anfragen gestellt. Ein
unvollständiges Setup beeinträchtigt den Stundenplan, Lernfortschritt und
die lokalen Empfehlungen nicht.

## Sicherheit und Kosten

- Frontend übermittelt nur einen **kleinen Studienkontext** (relevante
  Modulnamen, Themen, subjektive Check-ins, nächste Vorlesung, Klausuren).
  Kein E-Mail-Name, kein vollständiger Workspace, keine Supabase-Tokens an
  DeepSeek. Authentifizierung und Zugriffsentscheidung geschehen in Supabase.
- Die Edge Function prüft das **echte Supabase-JWT**, Premium über
  `account_directory` und ruft erst dann DeepSeek auf.
- Die SQL-Funktion `uniflow_consume_ai_quota` limitiert **atomar** auf
  **25 Anfragen pro Nutzer und UTC-Tag**. Eine zusätzliche Stunden-
  oder 90-Sekunden-Sperre gibt es nicht.
- **Eine neue KI-Empfehlung wird pro App-Öffnung oder Rückkehr aus einem
  ausgeblendeten Browser-Tab höchstens einmal angefordert.** Das passiert nur,
  wenn Premium + KI-Modus aktiv sind, die Seite sichtbar ist und das
  Tageskontingent noch nicht verbraucht wurde.
- **Kein Timer für KI-Anfragen:** Solange die App offen bleibt, wird nicht
  automatisch jede Stunde neu angefragt. Beim Wechsel zwischen Dashboard,
  Kalender und Einstellungen entsteht ebenfalls keine neue Anfrage.
- **Geschlossen oder im Hintergrund:** keine neuen Modellaufrufe, keine
  Warteschlange, keine Nachholanfragen. Eine neue App-Öffnung kann unmittelbar
  erneut anfragen (bis höchstens 25 pro Tag).
- Lokale und serverseitige Tageszähler schützen vor unkontrollierten Kosten.
  Bei geänderten Veranstaltungen oder Bewertungen fällt die Anzeige zunächst
  auf den aktuellen lokalen Vorschlag zurück, statt im selben Öffnungsvorgang
  eine weitere KI-Anfrage zu starten.
- Die letzte passende KI-Empfehlung wird in der Browser-Sitzung gehalten.
- Fehler und fehlende API-Konfiguration führen ebenfalls zu lokalen Empfehlungen.
  Nur tatsächlich mit DeepSeek erzeugte Premium-Empfehlungen zeigen das
  **Sternsymbol (Sparkles)** und einen dezenten Farbverlauf. Kostenlose
  Empfehlungen behalten das normale Design.
- DeepSeek erhält eine JSON-Anfrage und soll eine kurze deutschsprachige
  JSON-Empfehlung zurückgeben. Fehler/ungültige Ergebnisse => lokale
  Empfehlung statt App-Absturz.
- Bitte prüfe vor Live-Nutzung Datenschutzhinweise, Rechtsgrundlage und
  Drittlandübermittlung bei Verwendung von DeepSeek.
- Offizielle API-Dokumentation:
  https://api-docs.deepseek.com/
  https://api-docs.deepseek.com/api/create-chat-completion/

## Lokales Testen ohne Deployment

```bash
git fetch origin
git switch feature/premium-deepseek-context-lecture-feedback
npm ci
npm test
npm run dev
```

Für **`npm run build`** ist keine echte DeepSeek-API-Verbindung nötig.
Es wurden keine bestehenden Kalender-Terminerzeugungsregeln geändert.
Die neue SQL-Migration/Edge Function werden durch einen Git-Commit **nicht**
automatisch auf Supabase angewandt.

## Weitere Premium- und Kalenderfunktionen

- In **Module** ist die Schnelleingabe ausschließlich mit uniflow+ nutzbar.
  Der Beispieltext entfällt; während der Vorschauanalyse zeigt sie eine dezente
  Premium-Animation. Die Eingabe wird derzeit von einem **lokalen Parser**,
  nicht von DeepSeek interpretiert.
- Vorlesungen und Übungen sind beim Öffnen des Modul-Editors standardmäßig
  eingeklappt.
- Der Zeit-Picker nutzt vertikale Scrollräder für Stunden und alle
  **60 Minutenschritte**, mit denselben Gültigkeitsgrenzen wie bisher.
- Kalendertermine besitzen unten rechts einen Bewertungsstern; rechtsklicken
  und **Bewerten** öffnen dieselbe Bearbeitung der persönlichen Einschätzung.
  Abgeschlossene Termine können später erneut bewertet werden.
