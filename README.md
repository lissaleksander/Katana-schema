# Schema – Katana Parkour

Webbapp där chefen lägger coachernas schema per månad och exporterar det som en PNG till Discord.
Byggd enligt designdokumentet (version 1: alla *Måste*, plus *Bör* F16–F18).

Appen är helt statisk: ingen server, ingen inloggning. All data sparas i webbläsaren (IndexedDB)
och i en sparfil (`.json`) som är backupen.

## Använda appen

- **Ny månad**: `+ Ny månad` → välj månad → *Kopiera från* (förvald: föregående månad) eller *Tom månad*.
  Vid kopiering visas en sammanfattning, t.ex. ”124 aktiviteter kopierade, 3 kalas hoppades över”.
- **Lägga till pass**: hovra över en dag → `+` → välj typ (sök genom att skriva, Enter väljer första).
  Tiden fylls i från typen. Lägg till coacher i panelen till höger.
- **Byta coach på ett pass**: klicka på passet → klicka bort en namnlapp i panelen → klicka på en coach i
  vänsterlistan (den läggs till på det valda passet).
- **Snabbtilldelning**: utan valt pass (tryck `Esc`), klicka på en coach i vänsterlistan → klicka på pass för
  att lägga till eller ta bort coachen. Coachens pass lyses upp. `Esc` avslutar. En rad under ”Coacher”
  visar alltid vad ett klick gör. Antal pass per coach visas i listan.
- **Flytta pass**: dra det till en annan dag, eller ändra datum i panelen.
- **Ångra/gör om**: `Cmd+Z` / `Cmd+Shift+Z` (100 steg inom sessionen). `Delete` tar bort valt pass.
- **Visa**: visar exakt det som exporteras. Bildens språk väljs där (eller under Inställningar),
  oberoende av appens språk (`SV | EN`).
- **Exportera PNG**: 2400 px bred bild, `schema-ÅÅÅÅ-MM.png`. Månaden markeras som publicerad, och om
  något ändras efteråt visas ”Ändrad efter senaste export”.
- **Spara fil / Öppna fil**: se nedan.

### Spara och backup

- Allt sparas automatiskt i webbläsaren vid varje ändring.
- **Spara fil** skriver allt till en `.json`-fil. I Chrome och Edge skrivs samma fil över varje gång
  (lägg den t.ex. i iCloud Drive eller Dropbox). Safari laddar ned en ny fil varje gång – därför
  rekommenderas Chrome eller Edge.
- **Öppna fil** ersätter (efter bekräftelse) allt i appen med filens innehåll. Det går att ångra.
- Längst ned visas ”Senast sparad till fil”. Har filen inte sparats på 7 dagar och det finns ändringar
  visas en påminnelse.
- Två admins: en äger schemat åt gången och skickar sparfilen vidare. Appen varnar om den är öppen i
  två flikar samtidigt.

### Installera som app (offline)

Öppna sidan i Chrome → menyn → *Spara och dela* → *Installera sida som app*. Appen får en egen ikon i
Dock och fungerar offline. När en ny version publicerats visas en rad ”En ny version av appen finns” med
knappen *Ladda om* – appen laddas aldrig om mitt i arbetet.

## Utveckling

Kräver Node 20 eller senare.

```sh
npm install
npm run dev          # utvecklingsserver på http://localhost:5173
npm run build        # bygger till dist/
npm test             # enhetstester (Vitest)
npm run test:e2e     # webbläsartester (Playwright, kräver npm run build först)
npm run test:all     # typkontroll + alla tester
```

Första gången webbläsartesterna körs: `npx playwright install chromium`.

### Struktur

| Fil/mapp | Innehåll |
| --- | --- |
| `src/types.ts` | Datamodellen (coach, aktivitetstyp, månad, aktivitet, kalasuppgifter) |
| `src/lib/dates.ts` | Datumhjälp; datum är `ÅÅÅÅ-MM-DD`-strängar utan tidszon |
| `src/lib/copyMonth.ts` | Reglerna för att kopiera en månad (F3) |
| `src/lib/schedule.ts` | Sortering i dagrutan, titlar, varningar, antal pass |
| `src/lib/saveFile.ts` | Sparfilens format, validering och framtida uppgraderingar (`version`) |
| `src/lib/seed.ts` | Startdata: 15 coacher och 25 aktivitetstyper |
| `src/store/store.ts` | All data och alla ändringar; ångra/gör om |
| `src/store/persistence.ts` | Automatisk sparning i IndexedDB |
| `src/i18n/sv.json`, `en.json` | Gränssnittets texter |
| `src/components/` | Gränssnittet; `MonthCalendar` används både för redigering och export |
| `e2e/` | Webbläsartester av alla arbetsflöden |

Ändras sparfilens format: höj `DATA_VERSION` i `src/types.ts` och lägg till en uppgradering i
`migrate()` i `src/lib/saveFile.ts`, så att gamla filer fortfarande kan öppnas.

## Publicera

`npm run build` ger statiska filer i `dist/` som kan läggas på valfri statisk hosting
(GitHub Pages, Netlify, Cloudflare Pages). Sökvägarna är relativa, så appen fungerar även i en
undermapp.

För GitHub Pages finns `.github/workflows/deploy.yml`: den kör typkontroll och tester och publicerar
vid varje push till `main`. Slå på *Settings → Pages → Source: GitHub Actions* i repot.

## Beslut som togs vid bygget

Saker som designdokumentet inte bestämde helt:

- **Klick på en coach i vänsterlistan** (arbetsflöde 2 och 3): med ett valt pass läggs coachen till på det;
  utan valt pass startar snabbtilldelning. I snabbtilldelning byter ett klick på en annan coach bara coach.
- **Markera coach (F17)** är inbyggt i snabbtilldelningen: coachens pass lyses upp och övriga tonas ned.
- **Kopiering av månad** hoppar även över pass vars aktivitetstyp är inaktiv, och inaktiva coacher följer
  inte med. Båda redovisas i sammanfattningen.
- **Kopiera till dagar (F8)** hoppar över dagar där samma pass (typ och tid) redan finns.
- **Ordning i dagrutan**: kalas först, sedan alla pass på starttid, öppet gym sist.
- **Kalas** visar ”Kalas 8 år” / ”Party 8 YO”. Kontakt och kalasanteckning syns bara i appen.
- **Läger** som börjar i en månad och slutar i nästa syns i båda månaderna; det ”hör till” startmånaden.
- **Ta bort månad** finns (med bekräftelse och ångra) och tar bort de pass som börjar i månaden. Ett läger
  som fortsätter in i nästa månad finns kvar där från den 1:a.
- **Byt coach i period (F16)** byter coach på hela lägret om lägret delvis ligger i perioden.
- **Export** räknas inte som ett ångra-steg; ”Publicerad” finns kvar även om man ångrar ändringar.
- **Skadad data i webbläsaren** skrivs aldrig över automatiskt: appen visar en varning och väntar tills man
  öppnar en sparfil eller väljer ”Börja om”. En kopia av den skadade datan sparas i webbläsaren.
- **Nedladdade sparfiler** (Safari/Firefox) får datum och tid i namnet, t.ex.
  `katana-schema-2026-10-26-1430.json`, så att det syns vilken som är nyast.
- I **redigeringsläget** ligger namnlapparna under titeln eftersom rutorna är smala; i visningsläget och
  bilden ligger de till höger om tid och namn.
- Tider skrivs som text (`1700`, `17.00` och `17:00` fungerar) för att fungera likadant i alla webbläsare.

## Testat

- 78 enhetstester: datum (skottår, sommartid, månadsgränser), alla kopieringsregler, sparfilens
  validering, ångra/gör om, varningar, översättningar (samma nycklar och platshållare på båda språken).
- 47 webbläsartester i Chromium som går igenom alla funktioner F1–F18 via gränssnittet, inklusive att
  PNG-filen är 2400 px bred, att kalasets e-post aldrig hamnar i bilden, att sparfilen går att öppna i en
  annan webbläsare, offline-läge, skadad data och att varje test är fritt från fel i konsolen.
- En oberoende kodgranskning gjordes; alla fynd är åtgärdade och har fått egna tester.
- Safari har inte kunnat testas automatiskt; kända Safari-problem med bildexport är hanterade i koden.
- `npm audit` varnar för Vitest 3 (testverktyget, körs bara lokalt). Den publicerade appen har inga kända
  sårbarheter (`npm audit --omit=dev`). Vitest 4 går i dag inte att installera med npm 10 på grund av en
  npm-bugg; uppgradera när det fungerar.
