# Plan dalszych prac — Hogwart RPG

Lista wybrana przez Maćka 9 listopada 2026. Każdy punkt można zacząć niezależnie. Opisy niżej to projekt wykonania: co powstaje, z czego korzysta i co trzeba ustalić przed startem.

Zasady stałe:
- Praca na gałęzi `animacje-postaci`. Scalenie z `main` (publiczna strona) tylko po zgodzie Maćka.
- Postacie z książek nie są upodabniane do filmowych oryginałów. Herby domów i logotypy zostają poza grą. Nowe postacie są autorskie (jak Szelma i Pani Leokadia).
- Każda funkcja dostaje test w `tests/`, przejście w przeglądarce bez błędów i krótki film.

| Nr | Zadanie | Wielkość | Zależy od |
|---|---|---|---|
| 2 | Punkty domów i klepsydry | mała | — |
| 11 | Biblioteka i Kronika | średnia | — |
| 1 | Rozdział II w zamku | duża | 2, 11 (ułatwiają) |
| 3 | Noc w zamku i skradanie | duża | 8 (dźwięk kroków), pasuje do 1 |
| 10 | Eliksiry z mieszaniem | średnia | `gestures.js` |
| 8 | Dźwięk zamku | średnia | — |
| 7 | Lekcje bez myszy | mała | `lessons.js` |
| 4 | Wielka Sala jako perełka (szczególna moc obliczeniowa) | bardzo duża | najlepiej moc obliczeniowa komputera Maćka |
| 12 | Lepsze twarze postaci | bardzo duża | Blender, `tools/blender/` |

Proponowana kolejność: 2 → 11 → 1 → 3 → 10 → 8 → 7, a 4 i 12 równolegle, kiedy będzie dostęp do mocniejszego sprzętu.

---

## 1. Rozdział II w zamku: „Skradzione strony”

Szelma kradnie strony przewodnika po zamku. Pomocnica w bibliotece, Agata Sowińska, prosi o pomoc.

Etapy:
1. Agata zgłasza kradzież. Strony znikają z miejsc, w których już leżały.
2. Ślady kredy na posadzkach pięter 1–3 widać dopiero w świetle Lumos. Prowadzą do kryjówek.
3. Pościg: Szelma ucieka korytarzami i gubi strony. Trzeba go dogonić, zanim zniknie w ścianie.
4. Pułapka w wieży. Lewitujące świece (Leviosa) zamykają mu drogę ucieczki na szczycie schodów.
5. Rozmowa z Szelmą w filmowej kamerze. Zostaje „sprzymierzeńcem”, który od tej pory podpowiada sekrety.

Potrzebne:
- Rozdziały w systemie zadań (`QUESTS` w `state.js` ma teraz 8 etapów rozdziału I).
- Zakładka rozdziałów w dzienniku.
- Nowe stany Szelmy w `castle-life.js`: `flee`, `hide`, `caught`.
- Ślady kredy jako naklejki na posadzce widoczne tylko przy Lumos.
- Zapis w `state` z walidacją w `hydrate`.

## 2. Punkty domów i klepsydry

- `state.housePoints = {gryffindor, ravenclaw, hufflepuff, slytherin}` z walidacją.
- Punkty gracza:
  - lekcja zaliczona: +5;
  - nowa biegłość: +10;
  - wygrany pojedynek: +10 / +15 / +25;
  - strona przewodnika: +5;
  - etap zadania: +20;
  - złapanie w nocy przez woźnego: −10.
- Pozostałe domy zbierają punkty powoli w tle (stała, przewidywalna symulacja zapisana w stanie).
- Klepsydry w Sali Wejściowej: `castle.setHouseLevels()` już istnieje, trzeba je podłączyć do punktów.
- Komunikat „+10 punktów dla Ravenclawu” w kolorze domu, bez herbów.
- Tabela w dzienniku i wynik na koniec rozdziału.

## 3. Noc w zamku i skradanie

- Pora nocna w zamku: ciemniejsze pochodnie, księżycowe smugi z okien, śpiące portrety (bez ruchu postaci w ramie).
- Cisza nocna włącza się w wybranych etapach rozdziału II albo w nocnym spacerze z mapy.
- Woźny z latarnią ma stożek widzenia i obchód po trasie. Słyszy kroki: bieg jest głośny, skradanie (Ctrl) ciche.
- Lumos pomaga widzieć, ale zdradza gracza z daleka.
- Kryjówki: za zbrojami, w niszach i za gobelinem.
- Złapanie kończy się powrotem do Sali Wejściowej i −10 punktów domu.
- Szelma może psocić i zwabić woźnego.

## 4. Wielka Sala jako perełka (szczególna moc obliczeniowa)

Najbardziej efektowna sala w grze, budowana od nowa:
- Architektura z Blendera:
  - wysokie gotyckie okna z witrażami (autorskie wzory);
  - kamienne łuki;
  - podium nauczycieli;
  - cztery długie stoły z ławami.
- Zaczarowany sufit: niebo w shaderze, zsynchronizowane z porą dnia na zewnątrz. Chmury za dnia, gwiazdy i pasmo galaktyki nocą, powolny dryf.
- Kilkaset lewitujących świec: jeden obiekt instancjonowany i migotanie w shaderze.
- Wypalone światło: globalne oświetlenie i cienie wypieczone w Blenderze (Cycles) do map światła. Tu potrzebna jest moc obliczeniowa. Na komputerze Maćka z kartą graficzną wypiek trwa minuty, w chmurze na 2 rdzeniach godziny.
- Życie sali: uczniowie siedzący przy stołach, uczta (talerze, dzbany), duch przenikający przez stół, rozmowy przy stołach.
- Wydajność:
  - mapy światła w KTX2;
  - świece i naczynia instancjonowane;
  - LOD dla stołów;
  - test FPS na prawdziwej karcie (Claude in Chrome na komputerze Maćka).

Do ustalenia: czy na komputerze Maćka jest Blender i jaka karta graficzna. Wtedy wypiek można uruchomić tam przez połączenie aplikacji desktopowej.

## 7. Lekcje bez myszy (tryb ułatwień)

Przełącznik w ustawieniach dostępności: „Lekcje z pomocą”.

Do wyboru:
- Prowadzenie ręki: punkt sam przesuwa się po wzorze, a gracz trzyma Spację w rytmie ruchu. Ocena za równe tempo.
- Strzałki: zygzak, cięcie i uniesienie da się „narysować” klawiszami kierunków.
- Pomoc po dwóch nieudanych próbach: wzór pozostaje widoczny i tolerancja rośnie.

Sterowanie padem (opcjonalnie): lewa gałka rysuje ruch.

## 8. Dźwięk zamku

Wszystko w WebAudio, bez plików, z poszanowaniem ustawienia dźwięku:
- Pogłos z impulsów generowanych dla każdego wnętrza: Sala Wejściowa (duża), korytarze (średnie), lochy (wilgotne, krótkie).
- Kroki z echem, inne na kamieniu, drewnie i dywanie.
- Tło: wiatr w oknach, trzask pochodni zależny od odległości, daleki gwar uczniów, szum schodów, gdy się obracają.
- Muzyka autorska: proceduralne melodie (celesta, harfa, smyczki z syntezy), inne w każdej części zamku, cichną w rozmowach.
- Szelma: chichot i świst kredy. Portrety: szepty, gdy się przechodzi.

## 10. Eliksiry z mieszaniem

- Stanowisko z kociołkiem w lochach. Widok z góry na kociołek w nakładce podobnej do tabliczki z lekcji.
- Przepis to kroki:
  - dodanie składników (przeciąganie);
  - mieszanie: N okręgów w prawo lub w lewo, rysowanych jak w lekcjach;
  - regulacja ognia.
- Kierunek okręgu: znak pola wielokąta w `gestures.js` (do dopisania i przetestowania).
- Błąd daje kolorowy dym i nieudany wywar. Sukces daje eliksir.
- Przepisy jako przedmioty z biblioteki (łączy się z punktem 11).
- Nowe eliksiry: zdrowia (istnieje), many, szybkości, ochrony przed zimnem lasu.

## 11. Biblioteka i Kronika

- Książki na regałach, które da się czytać: autorskie teksty o zamku, magii i historii szkoły w nakładce z przewracaniem stron.
- Dział Ksiąg Zakazanych otwarty tylko nocą (łączy się z punktem 3).
- Kronika w dzienniku zapisuje sama:
  - odkryte strony i przejścia;
  - lekcje i biegłości;
  - pojedynki;
  - poznane postacie;
  - przeczytane książki.
- Każdy wpis ma krótką notatkę i datę gry.

## 12. Lepsze twarze postaci

- Nowa głowa w `tools/blender/model.py`:
  - gęstsza siatka w okolicy oczu, ust i nosa;
  - uszy;
  - powieki z grubością;
  - rogówka z wypukłością.
- Malowana skóra: tekstura koloru (piegi, rumieńce, różne odcienie), mapa normalnych z drobnymi detalami, tęczówka z teksturą.
- Te same nazwy kości i kształtów mimiki (`smile`, `browUp`…), żeby kod gry nie wymagał zmian.
- Lepsze włosy: pasma zamiast jednolitej skorupy w fryzurach długich i kucyku.
- Pomocne: arkusze referencyjne twarzy (autorskie, nie podobne do aktorów), np. z generatora obrazów Gemini, według opisów przygotowanych przez Claude.

## Narzędzia zewnętrzne

- **Codex:** niepotrzebny. To agent kodujący jak Claude. Nie ma karty graficznej ani lepszej grafiki. Dwa agenty w tym samym `game.js` (2400+ linii) tworzyłyby konflikty. Może ewentualnie zrobić niezależny przegląd gotowej funkcji.
- **Antigravity / Gemini:** przydatny głównie generator obrazów. Może zrobić obrazy do żywych portretów, ilustracje i okładki książek do biblioteki, wzory gobelinów i witraży, panoramę nieba do sufitu Wielkiej Sali i arkusze referencyjne twarzy. Claude przygotuje dokładne opisy: rozmiar, styl, paleta, przezroczyste tło, bez herbów, logo i podobieństwa do aktorów.
- **Komputer Maćka:**
  - testy na prawdziwej karcie graficznej przez Claude in Chrome;
  - wypiek światła w Blenderze dla Wielkiej Sali.

## Przegląd kodu z 9 listopada 2026 (Fable 5.2) i co z niego wynika

Naprawione w tym przeglądzie:
- Profesor i rekwizyty sali w lochach „wisiały” w powietrzu, gdy sala doczytała się, kiedy gracz był jeszcze na schodach.
- Zaklęcia w salach zamku zatrzymywały się na każdym meblu, bez względu na jego wysokość (nie dało się trafić kamienia za ławką).
- Kurz w powietrzu przyspieszał z każdą minutą gry.
- Uczniowie blokowali ławki i partnerów do rozmowy, gdy plan im się nie udał; przechodzili przez gracza.
- Kreda Szelmy wywoływała czerwony błysk obrażeń i tryb walki.
- Kamera rozmów gubiła kompozycję po sekundzie, a „oddech” kamery nie działał.
- Przerwana lekcja zostawiała rękę postaci w powietrzu; przycisk „Pokaż ponownie” mógł zderzyć się z oceną próby.
- Nieudane wczytanie miejsca mogło zostawić czarny ekran.
- Dwie sale budowane w jednej klatce robiły przycięcie na korytarzu (teraz doczytują się po kolei).
- Grafika: nowy gracz startuje na „Wysokiej”; gra sama schodzi poziom niżej, gdy brakuje klatek, a wybór z ustawień zostawia w spokoju.

Większe rzeczy, do których Fable 5.2 nadaje się najlepiej (długa, samodzielna praca z wieloma krokami i sprawdzaniem wyniku):

| Nr | Zadanie | Po co |
|---|---|---|
| F1 | Lżejsze postacie z daleka: w Blenderze połączyć części dalekiego modelu w jedną siatkę | Postać to dziś ok. 20–30 osobnych rysowań. Po zmianie daleka postać to 3–5. Największy zysk klatek w tłumie (Wielka Sala, korytarze). |
| F2 | Automatyczny gracz testowy: bot przechodzi rozdział I, zamek, lekcję i pojedynek po każdej zmianie | Złapałby sam błędy takie jak wiszący profesor. Bez tego każdą funkcję sprawdza się ręcznie. |
| F3 | Podział `game.js` (ponad 2500 linii) na moduły: rozmowy, walka, zadania, interfejs, strefy | Mniej błędów przy rozdziale II i kolejnych funkcjach; łatwiejsze testy. |
| F4 | Reżyserowane scenki: mały język osi czasu dla kamery (najazd, kran, zmiana ostrości), postaci i dźwięku | Sceny fabularne „jak w Wiedźminie 3” zamiast samych rozmów; potrzebne do rozdziału II. |
| F5 | Nawigacja postaci po całym zamku: graf przejść, schody, plan dnia (lekcje, posiłki, cisza nocna) | Uczniowie chodzą między piętrami i na lekcje, a nie tylko po jednym korytarzu. Podstawa nocy w zamku (punkt 3). |
| F6 | Pomiar wydajności na komputerze Maćka: czas klatki z podziałem na etapy, sprawdzenie, której karty używa przeglądarka | RTX 4050 powinien dawać dużo więcej niż 14–30 klatek. Trzeba ustalić przyczynę, zanim dojdzie Wielka Sala. |

Punkty 4 (Wielka Sala) i 12 (twarze) z listy wyżej też są zadaniami tego typu: wymagają wielu rund „zbuduj w Blenderze → wyrenderuj → obejrzyj → popraw”.

