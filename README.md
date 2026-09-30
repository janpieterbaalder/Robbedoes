# Robbedoes

Mobiele voetbalzoeker met een donkere rood-witte vormgeving. Onafhankelijk van Feyenoord. Gebouwd met Next.js App Router, TypeScript, React en optioneel Neon Auth/Postgres.

## Starten

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Voor productie: `npm run build` gevolgd door `npm start`. Node.js 22 of hoger.

## Wat werkt

Zoeken op GPS of plaatsnaam, datumbereik tot 31 dagen, hemelsbrede afstand tot 500 km, sorteren, ticketindicaties, wedstrijddetails, clubwebsite, Google Maps-route, agenda-export, lokale favorieten en installatie op het beginscherm. Neon-accountregistratie, inloggen en favorieten per gebruiker zijn geïmplementeerd maar vereisen onderstaande configuratie.

De app opent met actuele wedstrijden rond Rotterdam. **Bekijk voorbeeld** schakelt naar fictieve wedstrijden met ticketsterren. Er is geen stille fallback van echte wedstrijden naar voorbeelddata. Voorbeeldwedstrijden worden ook in agenda-export als voorbeeld gemarkeerd.

Vindt een zoekopdracht niets, dan zegt de app waarom: de eerstvolgende speeldag binnen de straal (bijvoorbeeld na een interlandperiode, met knop om daarheen te springen) of, buiten de dekking, het dichtstbijzijnde stadion dat wel gedekt is.

## Wedstrijdgegevens en beperkingen

### Dekking

| Land                | Competities                             | Bron (zonder sleutel)                |
| ------------------- | --------------------------------------- | ------------------------------------ |
| Nederland           | Eredivisie                              | openfootball                         |
| Duitsland           | Bundesliga, 2. Bundesliga, 3. Liga      | OpenLigaDB, openfootball als reserve |
| Engeland en Wales   | Premier League, Championship            | openfootball                         |
| Spanje              | LaLiga                                  | openfootball                         |
| Italië              | Serie A                                 | openfootball                         |
| Frankrijk en Monaco | Ligue 1                                 | openfootball                         |
| Portugal            | Liga Portugal (incl. Madeira en Azoren) | openfootball                         |

Met `FOOTBALL_DATA_API_KEY` (gratis account bij football-data.org) komt de Champions League erbij en dient football-data.org als reservebron voor de competities die het gratis abonnement dekt. Niet gedekt: België, Schotland, Oostenrijk, Zwitserland, Scandinavië, Oost-Europa en de meeste tweede niveaus. Het ontbreken van resultaten is geen bewijs dat er niet gevoetbald wordt.

### Bronnen

- **openfootball/football.json**: publiek domein, dagelijks automatisch bijgewerkt, via `raw.githubusercontent.com` zonder sleutel. Aftraptijden staan in lokale tijd van de competitie en worden per wedstrijd naar UTC omgerekend (zomer- en wintertijd inbegrepen). Wedstrijden waarvan de competitie de tijd nog niet heeft vastgesteld, tonen **tijd volgt** en worden als hele-dagafspraak geëxporteerd. Let op: de Premier League publiceert verre wedstrijden met de voorlopige standaardtijd za 15:00; die tijd is dus geen bevestiging.
- **OpenLigaDB**: communitygegevens voor de drie Duitse profcompetities, met UTC-tijden.
- **football-data.org v4** (optioneel): verzoeken in vaste vensters van zeven dagen, zodat gebruikers dezelfde gecachte antwoorden delen en de limiet van het gratis abonnement (10 verzoeken per minuut) buiten zicht blijft.

`/api/status` controleert alle bronnen live, inclusief of de football-data.org-sleutel werkt (`ok`, `error` met HTTP-status en uitleg, of `not_configured`). Open bijvoorbeeld `https://robbedoes-alpha.vercel.app/api/status`.

Per competitie probeert de server de bronnen op volgorde; valt er één uit, dan neemt de volgende het over. Competities zonder bereikbare bron worden in de app gemeld. De server haalt alleen competities op met een gedekt stadion binnen de zoekstraal. Antwoorden worden een kwartier (OpenLigaDB, football-data.org) of een uur (openfootball) gecachet; bij een storing van de bron worden gegevens tot een dag oud gebruikt. Tijdstippen moeten altijd bij de club worden bevestigd.

### Stadioncatalogus

`lib/clubs.ts` bevat 195 clubs met stadion, stad, coördinaten, tijdzone, clubwebsite en de schrijfwijzen die bronnen gebruiken. `lib/club-lookup.ts` koppelt namen van bronnen aan clubs: exact op genormaliseerde naam, en binnen het land van de competitie ook op alle woorden van een alias. Tweede elftallen worden nooit aan het stadion van het eerste elftal gekoppeld; clubs die niet in de catalogus staan, worden overgeslagen en gemeld, niet geraden.

De coördinaten zijn bij benadering: voor 91 clubs gecontroleerd tegen een openbare dataset (afwijking maximaal 0,3 km, verhuisde stadions uitgezonderd), voor kleinere clubs een schatting die enkele kilometers kan afwijken. Stadionwissels tot en met 2026/27 zijn verwerkt, zoals Everton (Hill Dickinson Stadium), Real Betis (La Cartuja), Barcelona (terug in Camp Nou) en Casa Pia (Rio Maior, 70 km van Lissabon). Clubs zonder zeker bekende website krijgen een zoeklink in plaats van een gegokt domein.

Na promoties en degradaties: `npm run check:coverage` haalt de actuele seizoensbestanden op en meldt teams zonder stadion. Voeg die toe aan `lib/clubs.ts` en werk `tests/fixtures/teams.ts` bij.

Plaatsnamen via Open-Meteo Geocoding / GeoNames. Bronnen: https://github.com/openfootball/football.json, https://api.openligadb.de, https://docs.football-data.org/general/v4/index.html, https://open-meteo.com/en/docs/geocoding-api. Afstanden zijn hemelsbreed, geen rijafstanden.

### Ticketsterren

Alleen de fictieve voorbeelden hebben sterren. De transparante demonstratieregel is: handmatig ingeschatte hoge vraag = 2, gemiddelde vraag = 3, lagere vraag = 4; derby = één ster minder. Dit is geen statistisch model, kanspercentage, clubcardcontrole of actuele kaartvoorraad. Echte wedstrijden tonen **Ticketkans onbekend**. Voor bruikbare live scores is geverifieerde club- of ticketinformatie nodig. De links leiden naar clubwebsites, niet naar beloofde beschikbare kaarten. Uitvakken en restricties moeten gebruikers zelf controleren.

## Neon-accounts activeren

Maak een eigen Neon-project en ontwikkelbranch aan. Activeer Neon Auth en registreer het appdomein als trusted domain. Gebruik de projectwaarden voor `NEON_AUTH_BASE_URL` en `DATABASE_URL`. Genereer een `NEON_AUTH_COOKIE_SECRET` van minimaal 32 willekeurige tekens, bijvoorbeeld met `openssl rand -base64 32`. Voer `db/schema.sql` uit als database-eigenaar. De server gebruikt de eigenaarverbinding; RLS schermt de tabel af voor publieke database-rollen. Er is geen directe Data API-toegang.

Zet de drie variabelen in de hostingomgeving en deploy opnieuw. De app toont dan de registratie- en inlogformulieren. Zorg dat e-mailverificatie en verzender in Neon Auth zijn ingericht. De favorieten-API haalt de gebruiker uit de serversessie, nooit uit een clientparameter. Elke query is aan die gebruiker gebonden. Schrijfacties controleren Origin. Sessies zijn via de officiële Neon Auth Next.js-adapter ingericht.

Zonder configuratie wordt geen werkend account gesuggereerd: favorieten blijven in localStorage op dit apparaat. Lokale favorieten worden niet automatisch naar een nieuw account gekopieerd. Ingelogde favorieten blijven bij uitloggen buiten localStorage. De Neon-code is gecompileerd; registratie en synchronisatie zijn zonder aangesloten Neon-project niet end-to-end getest.

## Publiceren

Importeer dit bestaande GitHub-project in Vercel, kies Next.js en publiceer. Voor de wedstrijdzoeker zijn geen secrets vereist. Stel voor accounts en meer wedstrijden de optionele variabelen uit `.env.example` in. Deel nooit sleutels in GitHub of clientvariabelen. Deze repository bevat geen credentials. De app is in deze oplevering nog niet online gepubliceerd.

## Privacy en installatie

GPS vraagt expliciet browsertoestemming. Locaties worden per zoekopdracht, afgerond op twee decimalen (ongeveer 1 km), naar de appserver gestuurd en niet als locatiegeschiedenis in een database bewaard. De server stuurt geen locaties door naar wedstrijdbronnen. Provider- en hostinglogs kunnen requestmetadata bevatten. Plaatsnamen worden aan de geocodingprovider gestuurd. Externe lettertypen komen van Google Fonts. Een service worker levert uitsluitend een offline-melding; accountpagina's, persoonsgegevens en wedstrijdantwoorden worden niet offline gecachet.

Op iPhone: Safari → Delen → Zet op beginscherm. Op Android: browsermenu → App installeren. GPS en service workers vereisen HTTPS, behalve op localhost.

## Validatie

`npm test` controleert de afstandsberekening (ook de datumgrens), datumfiltering in stadiontijdzone, zoekstraal, onbekende ticketkansen, tijdzoneomrekening rond zomer- en wintertijd, de drie bronformaten, de koppeling van alle 156 teamnamen uit de openfootball-competities van 2026/27, de catalogus en de zoeklogica (bronkeuze, fallback, meldingen, volgende speeldag, dichtstbijzijnd stadion) met nagebootste bronnen. `npm run build` controleert de volledige productiebuild en TypeScript. GitHub Actions voert beide uit bij pushes en pull requests.

De Europese zoekfunctie is in de productieversie in een mobiele browser gecontroleerd met echte openfootball-gegevens: Rotterdam, Londen, Dortmund, Barcelona, Milaan en Lissabon, een lege interlandweek met de knop naar de volgende speeldag, een wedstrijd zonder aanvangstijd (weergave en agenda-export) en Brussel buiten de dekking. OpenLigaDB is gecontroleerd op de Vercel-preview: Bundesliga, 2. Bundesliga en 3. Liga laden, en over 9 t/m 18 oktober 2026 werden alle Duitse thuisteams gekoppeld. football-data.org is alleen getest met nagebootste antwoorden in het gedocumenteerde formaat.

De productieversie is eerder in de browser gecontroleerd op het bewaren van een wedstrijd, openen en sluiten van details, wijzigen van de straal (50 → 25 km, zes → vijf voorbeeldresultaten), en de mobiele weergave op 390 px. Een mobiele schermafbeelding staat in `docs/mobile-preview.jpg`. In deze omgeving werkte Next.js development-hydration niet via de previewproxy; de productieversie werkte wel.
