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

De app opent bewust in een herkenbare voorbeeldmodus met fictieve wedstrijden rond Rotterdam. Via **Zoek echte wedstrijden** wordt de serverkoppeling gebruikt. Er is geen stille fallback van echte wedstrijden naar voorbeelddata. Voorbeeldwedstrijden worden ook in agenda-export als voorbeeld gemarkeerd.

## Wedstrijdgegevens en beperkingen

Zonder sleutel gebruikt de server OpenLigaDB (`https://api.openligadb.de/getmatchdata/bl1/{season}`), alleen Bundesliga. Dit zijn communitygegevens die onvolledig kunnen zijn. Het ontbreken van resultaten is geen bewijs dat er geen wedstrijden plaatsvinden. Tijdstippen moeten altijd bij de club worden bevestigd.

Met `FOOTBALL_DATA_API_KEY` gebruikt de server football-data.org v4. De dekking hangt af van het abonnement. De eerste stadioncatalogus in `lib/venues.ts` omvat Bundesliga-clubs en een aantal Nederlandse clubs, dus ook met een API-sleutel is deze versie nog geen wereldwijde voetbalzoeker. Niet-gekoppelde stadions worden overgeslagen en gemeld. Voeg voor verdere landen geverifieerde stadionlocaties en provideraliassen toe, of vervang de adapter door een betaalde bron met stadioncoördinaten. Geen gokken op basis van alleen de stad.

Plaatsnamen via Open-Meteo Geocoding / GeoNames. Bronnen: https://open-meteo.com/en/docs/geocoding-api, https://api.openligadb.de, https://docs.football-data.org/general/v4/index.html. Coördinaten in de lokale stadioncatalogus zijn bij benadering. Afstanden zijn geen rijafstanden.

### Ticketsterren

Alleen de fictieve voorbeelden hebben sterren. De transparante demonstratieregel is: handmatig ingeschatte hoge vraag = 2, gemiddelde vraag = 3, lagere vraag = 4; derby = één ster minder. Dit is geen statistisch model, kanspercentage, clubcardcontrole of actuele kaartvoorraad. Echte wedstrijden tonen **Ticketkans onbekend**. Voor bruikbare live scores is geverifieerde club- of ticketinformatie nodig. De links leiden naar clubwebsites, niet naar beloofde beschikbare kaarten. Uitvakken en restricties moeten gebruikers zelf controleren.

## Neon-accounts activeren

Maak een eigen Neon-project en ontwikkelbranch aan. Activeer Neon Auth en registreer het appdomein als trusted domain. Gebruik de projectwaarden voor `NEON_AUTH_BASE_URL` en `DATABASE_URL`. Genereer een `NEON_AUTH_COOKIE_SECRET` van minimaal 32 willekeurige tekens, bijvoorbeeld met `openssl rand -base64 32`. Voer `db/schema.sql` uit als database-eigenaar. De server gebruikt de eigenaarverbinding; RLS schermt de tabel af voor publieke database-rollen. Er is geen directe Data API-toegang.

Zet de drie variabelen in de hostingomgeving en deploy opnieuw. De app toont dan de registratie- en inlogformulieren. Zorg dat e-mailverificatie en verzender in Neon Auth zijn ingericht. De favorieten-API haalt de gebruiker uit de serversessie, nooit uit een clientparameter. Elke query is aan die gebruiker gebonden. Schrijfacties controleren Origin. Sessies zijn via de officiële Neon Auth Next.js-adapter ingericht.

Zonder configuratie wordt geen werkend account gesuggereerd: favorieten blijven in localStorage op dit apparaat. Lokale favorieten worden niet automatisch naar een nieuw account gekopieerd. Ingelogde favorieten blijven bij uitloggen buiten localStorage. De Neon-code is gecompileerd; registratie en synchronisatie zijn zonder aangesloten Neon-project niet end-to-end getest.

## Publiceren

Importeer dit bestaande GitHub-project in Vercel, kies Next.js en publiceer. Voor voorbeeldmodus en OpenLigaDB zijn geen secrets vereist. Stel voor accounts en meer wedstrijden de optionele variabelen uit `.env.example` in. Deel nooit sleutels in GitHub of clientvariabelen. Deze repository bevat geen credentials. De app is in deze oplevering nog niet online gepubliceerd.

## Privacy en installatie

GPS vraagt expliciet browsertoestemming. Locaties worden per zoekopdracht naar de appserver gestuurd en niet als locatiegeschiedenis in een database bewaard. Provider- en hostinglogs kunnen requestmetadata bevatten. Plaatsnamen worden aan de geocodingprovider gestuurd. Externe lettertypen komen van Google Fonts. Een service worker levert uitsluitend een offline-melding; accountpagina's, persoonsgegevens en wedstrijdantwoorden worden niet offline gecachet.

Op iPhone: Safari → Delen → Zet op beginscherm. Op Android: browsermenu → App installeren. GPS en service workers vereisen HTTPS, behalve op localhost.

## Validatie

`npm test` controleert de afstandsberekening (ook de datumgrens), datumfiltering in stadiontijdzone, zoekstraal en onbekende ticketkansen. `npm run build` controleert de volledige productiebuild en TypeScript. GitHub Actions voert beide uit bij pushes en pull requests.

De productieversie is in de browser gecontroleerd op het bewaren van een wedstrijd, openen en sluiten van details, wijzigen van de straal (50 → 25 km, zes → vijf voorbeeldresultaten), en de mobiele weergave op 390 px. Een mobiele schermafbeelding staat in `docs/mobile-preview.jpg`. In deze omgeving werkte Next.js development-hydration niet via de previewproxy; de productieversie werkte wel.
