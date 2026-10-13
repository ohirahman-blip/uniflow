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
  **25 Anfragen pro Nutzer/UTC-Tag** und mindestens **90 Sekunden** Abstand.
- Das Frontend stellt **höchstens eine DeepSeek-Anfrage pro Stunde und Nutzer**.
  Der Zeitpunkt des letzten Versuchs wird im Browser über einen Neustart hinaus
  gespeichert. Die erste Anfrage findet nur bei aktivem Premium-KI-Modus
  und sichtbarer/geöffneter App statt. Danach ist frühestens **60 Minuten**
  später eine weitere Anfrage möglich.
- **Während die App geschlossen oder im Hintergrund ist, finden keine neuen
  Anfragen statt.** Es wird nichts nachgeholt oder in einer Warteschlange
  gesammelt. Beim nächsten Öffnen wird nur dann einmal angefragt, wenn die
  Stunde seit der letzten Anfrage bereits vergangen ist.
- Die letzte passende KI-Empfehlung wird in der Browser-Sitzung zwischengespeichert.
  Ändern sich relevante Vorlesungen, Themen oder Bewertungen, erscheint sofort
  wieder der lokal berechnete, aktuelle Tipp; dadurch entsteht keine zusätzliche
  DeepSeek-Anfrage vor Ablauf der Stunde.
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
