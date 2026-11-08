# Rätsel-App einrichten (ca. 15 Minuten)

Die Rätsel-App liegt unter `app/` und läuft mit auf GitHub Pages:

- Teilnehmer: `https://www.matsundroxy.de/app/`
- Admin: `https://www.matsundroxy.de/app/admin.html`

Login, Datenbank und Dateien liegen bei **Supabase** (kostenloser Tarif reicht).

## 1. Supabase-Projekt anlegen

1. Auf [supabase.com](https://supabase.com) mit GitHub oder E-Mail registrieren.
2. **New project** anlegen:
   - Name: `adventskalender`
   - Region: **Central EU (Frankfurt)**
   - Ein sicheres Datenbank-Passwort vergeben und gut aufheben.

## 2. Datenbank einrichten

1. Links **SQL Editor** öffnen, **New query** klicken.
2. Den kompletten Inhalt von [`schema.sql`](schema.sql) hineinkopieren und **Run** drücken.

Das legt Tabellen, Zugriffsregeln und den privaten Dateispeicher `raetsel` an.

## 3. Login per E-Mail-Link einstellen

1. **Authentication › URL Configuration**:
   - Site URL: `https://www.matsundroxy.de/app/`
   - Redirect URLs: `https://www.matsundroxy.de/app/**` hinzufügen
2. **Authentication › Sign In / Providers › Email**: aktiviert lassen.
3. Optional **Authentication › Email Templates › Magic Link** auf Deutsch ändern, z. B.:

   ```html
   <h2>Dein Anmelde-Link</h2>
   <p>Klicke hier, um dich beim Mats &amp; Roxy Rätsel-Adventskalender anzumelden:</p>
   <p><a href="{{ .ConfirmationURL }}">Jetzt anmelden</a></p>
   ```

**Wichtig:** Der eingebaute Mailversand von Supabase schafft nur wenige Mails pro Stunde.
Für mehr als eine Handvoll Teilnehmer unter **Project Settings › Authentication › SMTP Settings**
einen eigenen Mailversand eintragen. Kostenlos geht das z. B. mit
[Brevo](https://www.brevo.com) (300 Mails/Tag) oder [Resend](https://resend.com) (100 Mails/Tag).

## 4. Zugangsdaten in die Website eintragen

1. **Project Settings › API** (bzw. **Data API**) öffnen.
2. **Project URL** und den **anon public** Key kopieren.
3. In [`app/config.js`](../app/config.js) eintragen.

Der anon-Key ist öffentlich gedacht. Den **service_role**-Key niemals in die Website schreiben.

## 5. Dich selbst zum Admin machen

1. Auf `…/app/admin.html` mit deiner E-Mail anmelden (Link aus der Mail klicken).
2. Im **SQL Editor** einmal ausführen (E-Mail anpassen):

   ```sql
   update public.profiles set is_admin = true, approved = true
   where email = 'deine@email.de';
   ```

3. Admin-Seite neu laden. Weitere Admins (z. B. den Rätselersteller) kannst du danach direkt
   im Tab **Teilnehmer** per Häkchen ernennen.

## So läuft es im Advent

| Wer | Was |
| --- | --- |
| Teilnehmer | meldet sich unter `/app/` per E-Mail-Link an und gibt einen Namen ein |
| Admin | schaltet die Person nach Zahlung im Tab **Teilnehmer** frei |
| Rätselersteller | gestaltet das Rätsel in Canva, lädt es als PNG/PDF im Tab **Rätsel** hoch, trägt Datum, Uhrzeit und Lösung ein und setzt „Veröffentlichen“ |
| App | zeigt das Rätsel erst zur eingestellten Zeit, auch die Datei ist vorher gesperrt |
| Teilnehmer | gibt genau eine Antwort ab; die Uhrzeit kommt vom Server |
| Admin | sieht im Tab **Abgaben** alle Antworten mit Zeit auf die Millisekunde und kann die Bewertung von Hand korrigieren |
| Am 4. Advent | Tab **Rangliste** zeigt, wer das Finalrätsel zuerst richtig gelöst hat (mit allen vorherigen Rätseln) |

**Gut zu wissen:**

- Antworten werden ohne Groß/Kleinschreibung, Leerzeichen und Satzzeichen verglichen.
  Weitere Schreibweisen einfach als neue Zeile bei den Lösungen ergänzen; alle bisherigen
  Abgaben werden dann automatisch neu bewertet (eine Korrektur von Hand wird dabei überschrieben).
- „Teilnehmer sehen sofort, ob ihre Antwort richtig ist“ ist standardmäßig aus, damit
  niemand Lösungen weitererzählt.
- Pro Rätsel und Person zählt nur die erste Antwort, genau wie bisher bei WhatsApp.
