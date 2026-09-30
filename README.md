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

Zoeken op GPS of plaatsnaam, datumbereik tot 31 dagen, hemelsbrede afstand tot 500 km, sorteren op datum of afstand, wedstrijddetails, clubwebsite, Google Maps-route, agenda-export, lokale favorieten en installatie op het beginscherm. Neon-accountregistratie, inloggen en favorieten per gebruiker zijn geïmplementeerd maar vereisen onderstaande configuratie.

De app opent met actuele wedstrijden rond Rotterdam. Er is geen voorbeeld- of testdata: alles wat de app toont, komt uit de wedstrijdbronnen.

Vindt een zoekopdracht niets, dan zegt de app waarom: de eerstvolgende speeldag binnen de straal (bijvoorbeeld na een interlandperiode, met knop om daarheen te springen) of, buiten de dekking, het dichtstbijzijnde stadion dat wel gedekt is.

## Wedstrijdgegevens en beperkingen

### Dekking

| Land                                                                    | Competities                                                           | Bron                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| Nederland                                                               | Eredivisie, Keuken Kampioen Divisie                                   | openfootball; ESPN                   |
| Duitsland                                                               | Bundesliga, 2. Bundesliga, 3. Liga                                    | OpenLigaDB, openfootball als reserve |
| Engeland en Wales                                                       | Premier League, Championship, League One, League Two, National League | openfootball; ESPN                   |
| Schotland                                                               | Premiership, Championship                                             | ESPN                                 |
| Spanje                                                                  | LaLiga, LaLiga 2                                                      | openfootball; ESPN                   |
| Italië                                                                  | Serie A, Serie B                                                      | openfootball; ESPN                   |
| Frankrijk en Monaco                                                     | Ligue 1, Ligue 2                                                      | openfootball; ESPN                   |
| Portugal                                                                | Liga Portugal (incl. Madeira en Azoren)                               | openfootball                         |
| België, Oostenrijk, Denemarken, Zweden, Noorwegen, Griekenland, Turkije | hoogste niveau                                                        | ESPN                                 |
| Europa                                                                  | Champions League, Europa League, Conference League                    | ESPN; football-data.org als reserve  |

Waar openfootball of OpenLigaDB een competitie levert, gaat die bron voor; ESPN is dan de laatste reserve. Niet gedekt: Zwitserland, Polen, Tsjechië, Kroatië, Servië, Roemenië, Hongarije en Ierland, de tweede niveaus van Portugal, België, Oostenrijk, Turkije, Griekenland en Scandinavië, en derde niveaus behalve de 3. Liga. Rusland zit er bewust niet in. Het ontbreken van resultaten is geen bewijs dat er niet gevoetbald wordt.

### Bronnen

- **openfootball/football.json**: publiek domein, dagelijks automatisch bijgewerkt, via `raw.githubusercontent.com` zonder sleutel. Aftraptijden staan in lokale tijd van de competitie en worden per wedstrijd naar UTC omgerekend (zomer- en wintertijd inbegrepen). Wedstrijden waarvan de competitie de tijd nog niet heeft vastgesteld, tonen **tijd volgt** en worden als hele-dagafspraak geëxporteerd. Let op: de Premier League publiceert verre wedstrijden met de voorlopige standaardtijd za 15:00; die tijd is dus geen bevestiging.
- **OpenLigaDB**: communitygegevens voor de drie Duitse profcompetities, met UTC-tijden.
- **ESPN** (`site.api.espn.com`): openbaar maar ongedocumenteerd en zonder sleutel, dus zonder afspraken; het kan zonder aankondiging veranderen of stoppen. Eén verzoek per competitie per kalendermaand, zes uur gecachet en hooguit vier tegelijk. ESPN weigert verzoeken met een eigen User-Agent, dus de server stuurt er geen mee. ESPN geeft per wedstrijd het stadion en of de aftraptijd vaststaat; zo niet, dan zet ESPN de wedstrijd op 20:00 UTC op een voorlopige datum en toont de app **tijd volgt** met de melding dat datum en tijd nog kunnen wijzigen.
- **football-data.org v4** (optioneel, `FOOTBALL_DATA_API_KEY`): reservebron voor vijf competities en de Champions League. Verzoeken in vaste vensters van zeven dagen, zodat gebruikers dezelfde gecachte antwoorden delen en de limiet van het gratis abonnement (10 verzoeken per minuut) buiten zicht blijft.

`/api/status` controleert alle bronnen live, inclusief of de football-data.org-sleutel werkt (`ok`, `error` met HTTP-status en uitleg, of `not_configured`). Open bijvoorbeeld `https://robbedoes-alpha.vercel.app/api/status`.

Per competitie probeert de server de bronnen op volgorde; valt er één uit, dan neemt de volgende het over. Voor de Europese bekers staat ESPN voorop, omdat ESPN het stadion van elke club in Europa noemt en football-data.org alleen clubs uit de catalogus kan plaatsen. Competities zonder bereikbare bron worden in de app gemeld. De server haalt alleen competities op met een stadion binnen de zoekstraal. Antwoorden worden een kwartier (OpenLigaDB, football-data.org), een uur (openfootball) of zes uur (ESPN) gecachet; bij een storing van de bron worden gegevens tot een dag oud gebruikt. Tijdstippen moeten altijd bij de club worden bevestigd.

### Stadions

Wedstrijden uit openfootball, OpenLigaDB en football-data.org worden via de clubcatalogus geplaatst, ESPN-wedstrijden via het stadion dat ESPN noemt.

`lib/clubs.ts` bevat 195 clubs met stadion, stad, coördinaten, tijdzone, clubwebsite en de schrijfwijzen die bronnen gebruiken. `lib/club-lookup.ts` koppelt namen van bronnen aan clubs: exact op genormaliseerde naam, en binnen het land van de competitie ook op alle woorden van een alias. Tweede elftallen worden nooit aan het stadion van het eerste elftal gekoppeld; clubs die niet in de catalogus staan, worden overgeslagen en gemeld, niet geraden. De coördinaten zijn voor 91 clubs gecontroleerd tegen een openbare dataset (afwijking maximaal 0,3 km, verhuisde stadions uitgezonderd); voor kleinere clubs zijn ze een schatting die enkele kilometers kan afwijken. Clubs zonder zeker bekende website krijgen een zoeklink in plaats van een gegokt domein.

`lib/venues.ts` bevat de 481 stadions waar de ESPN-competities in 2026/27 spelen, met coördinaten en tijdzone: 169 uit de clubcatalogus, 291 uit Wikidata, 12 uit OpenStreetMap, 8 met de hand geplaatst en 1 op het stadsmidden; bij 9 andere is ESPN's plaatsnaam met de hand verbeterd. 4 stadions zijn alleen op stadsniveau bekend. Het bestand wordt gemaakt door `npm run build:venues`. Dat script haalt het hele seizoen van elke ESPN-competitie op en zoekt per stadion de coördinaten, in deze volgorde: de clubcatalogus, het huidige thuisstadion van de club in Wikidata, een stadion met dezelfde naam in Wikidata, OpenStreetMap, en als laatste het centrum van de stad. Dat laatste is gemarkeerd als **locatie bij benadering**; de app toont dat en laat de routeknop dan op stadionnaam zoeken. Stadions waar alleen Europese bekerwedstrijden worden gespeeld, moeten dezelfde naam dragen als het thuisstadion in Wikidata, omdat kleine clubs die wedstrijden vaak naar een groter stadion verplaatsen. Correcties gaan in `VENUE_OVERRIDES` in `scripts/build-venues.ts`. ESPN noemt soms de verkeerde stad (Troyes als Paris, IK Start als Kristiansund); het script meldt elk stadion dat verder dan 25 km van ESPN's stad ligt of alleen op stadsniveau bekend is, zodat het met de hand kan worden nagelopen. Coördinaten deels © OpenStreetMap-bijdragers (ODbL) en uit Wikidata (CC0).

Na promoties en degradaties: `npm run check:coverage` meldt teams uit openfootball en OpenLigaDB zonder plek in de catalogus, en ESPN-stadions van de komende twee maanden die `lib/venues.ts` niet kent. Voeg clubs toe aan `lib/clubs.ts` (en werk `tests/fixtures/teams.ts` bij) of draai `npm run build:venues`.

Plaatsnamen via Open-Meteo Geocoding / GeoNames. Bronnen: https://github.com/openfootball/football.json, https://api.openligadb.de, https://docs.football-data.org/general/v4/index.html, https://www.wikidata.org, https://nominatim.openstreetmap.org, https://open-meteo.com/en/docs/geocoding-api. Afstanden zijn hemelsbreed, geen rijafstanden.

### Ticketkans

Er is geen betrouwbare bron voor kaartverkoop of beschikbaarheid, dus elke wedstrijd toont **Ticketkans onbekend**. De rekenregel in `lib/football.ts` (sterren op basis van verwachte vraag) wordt pas gebruikt als er geverifieerde club- of ticketinformatie is. De links leiden naar clubwebsites, niet naar beloofde beschikbare kaarten. Uitvakken en restricties moeten gebruikers zelf controleren.

## Neon-accounts activeren

Maak een eigen Neon-project en ontwikkelbranch aan. Activeer Neon Auth en registreer het appdomein als trusted domain. Gebruik de projectwaarden voor `NEON_AUTH_BASE_URL` en `DATABASE_URL`. Genereer een `NEON_AUTH_COOKIE_SECRET` van minimaal 32 willekeurige tekens, bijvoorbeeld met `openssl rand -base64 32`. Voer `db/schema.sql` uit als database-eigenaar. De server gebruikt de eigenaarverbinding; RLS schermt de tabel af voor publieke database-rollen. Er is geen directe Data API-toegang.

Zet de drie variabelen in de hostingomgeving en deploy opnieuw. De app toont dan de registratie- en inlogformulieren. Zorg dat e-mailverificatie en verzender in Neon Auth zijn ingericht. De favorieten-API haalt de gebruiker uit de serversessie, nooit uit een clientparameter. Elke query is aan die gebruiker gebonden. Schrijfacties controleren Origin. Sessies zijn via de officiële Neon Auth Next.js-adapter ingericht.

Zonder configuratie wordt geen werkend account gesuggereerd: favorieten blijven in localStorage op dit apparaat. Lokale favorieten worden niet automatisch naar een nieuw account gekopieerd. Ingelogde favorieten blijven bij uitloggen buiten localStorage. De Neon-code is gecompileerd; registratie en synchronisatie zijn zonder aangesloten Neon-project niet end-to-end getest.

## Publiceren

De app draait op Vercel: https://robbedoes-alpha.vercel.app. Elke merge naar `main` wordt automatisch gepubliceerd. Voor de wedstrijdzoeker zijn geen secrets vereist; `FOOTBALL_DATA_API_KEY` is een optionele reservebron. Stel voor accounts de optionele variabelen uit `.env.example` in. Deel nooit sleutels in GitHub of clientvariabelen. Deze repository bevat geen credentials.

## Privacy en installatie

GPS vraagt expliciet browsertoestemming. Locaties worden per zoekopdracht, afgerond op twee decimalen (ongeveer 1 km), naar de appserver gestuurd en niet als locatiegeschiedenis in een database bewaard. De server stuurt geen locaties door naar wedstrijdbronnen. Provider- en hostinglogs kunnen requestmetadata bevatten. Plaatsnamen worden aan de geocodingprovider gestuurd. Externe lettertypen komen van Google Fonts. Een service worker levert uitsluitend een offline-melding; accountpagina's, persoonsgegevens en wedstrijdantwoorden worden niet offline gecachet.

Op iPhone: Safari → Delen → Zet op beginscherm. Op Android: browsermenu → App installeren. GPS en service workers vereisen HTTPS, behalve op localhost.

## Validatie

`npm test` controleert de afstandsberekening (ook de datumgrens), datumfiltering in stadiontijdzone, zoekstraal, onbekende ticketkansen, tijdzoneomrekening rond zomer- en wintertijd, de vier bronformaten, de koppeling van alle 156 teamnamen uit de openfootball-competities van 2026/27, de catalogus, de stadiontabel en de zoeklogica (bronkeuze, fallback, plaatsing op stadion, Europese bekers, meldingen, volgende speeldag, dichtstbijzijnd stadion) met nagebootste bronnen. `npm run build` controleert de volledige productiebuild en TypeScript. GitHub Actions voert beide uit bij pushes en pull requests.

De Europese zoekfunctie is in de productieversie in een mobiele browser gecontroleerd met echte openfootball-gegevens: Rotterdam, Londen, Dortmund, Barcelona, Milaan en Lissabon, een lege interlandweek met de knop naar de volgende speeldag, een wedstrijd zonder aanvangstijd (weergave en agenda-export) en Brussel buiten de dekking. OpenLigaDB is gecontroleerd op de Vercel-preview: Bundesliga, 2. Bundesliga en 3. Liga laden, en over 9 t/m 18 oktober 2026 werden alle Duitse thuisteams gekoppeld. football-data.org is alleen getest met nagebootste antwoorden in het gedocumenteerde formaat.

De productieversie is eerder in de browser gecontroleerd op het bewaren van een wedstrijd, openen en sluiten van details, wijzigen van de straal, en de mobiele weergave op 390 px. Een mobiele schermafbeelding staat in `docs/mobile-preview.jpg`. In deze omgeving werkte Next.js development-hydration niet via de previewproxy; de productieversie werkte wel.
