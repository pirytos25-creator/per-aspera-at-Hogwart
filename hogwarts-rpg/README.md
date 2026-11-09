# Hogwart — Szlaki Magii

Osobny projekt gry RPG, obok `hogwarts-atlas`. Atlas, jego repozytorium i publikacja nie są modyfikowane.

## Uruchomienie

W katalogu projektu: `npm start`, następnie http://127.0.0.1:4174/. Nie wymaga instalacji pakietów. Wszystkie zasoby Three.js, font i tekstury są lokalne.

`npm run check` sprawdza składnię. `npm test` sprawdza postęp zadań, zapisy, ekwipunek, talenty, kolizje i rozpoznawanie ruchów różdżki.

## Postacie i animacje

Uczniowie i profesorowie to jeden model z Blendera (`dist/assets/models/wizard.glb`, ok. 1,6 MB po kompresji meshopt) ze szkieletem, palcami, mimiką i 36 animacjami: spoczynek, chód, trucht, bieg, krok w bok, osobny gest dla każdego zaklęcia, tarcza, trafienie z przodu i z tyłu, upadek i wstawanie, uniki w cztery strony, siadanie, czytanie, ukłon, machanie, wskazywanie, śmiech i inne. Twarz ma powieki, rzęsy, brwi, zęby i kształty mimiki (uśmiech, złość, smutek, zdziwienie…), usta poruszają się z wypowiadanym tekstem, a oczy i głowa podążają za tym, na kogo postać patrzy. Daleko od kamery postać przełącza się na lżejszą wersję (LOD).

Opcje postaci: kolory, fryzura (`style: 'short' | 'long' | 'bun' | 'pony' | 'curly'`), broda, kapelusz, rysy twarzy (`face: {soft, old, broad, nose}`), sylwetka i skala. Cienie postaci są liczone na żywo (`char-shadows.js`), osobno od wypalonych cieni świata, więc nikt nie zostawia cienia tam, gdzie stał.

Podgląd całej obsady: `postacie.html` (Sala Prób). Skrypty do przebudowy modelu są w `tools/blender/`. Jeśli model się nie wczyta, gra użyje wcześniejszych, prostszych postaci (`actors-proc.js`).

## Zamek do chodzenia

Z dziedzińca wchodzi się do zamku piechotą: Sala Wejściowa z lewitującymi świecami i klepsydrami domów, wieża z ruchomymi schodami, które same obracają się między piętrami, lochy i trzy piętra korytarzy. Sale z atlasu stoją przy korytarzach i doczytują się, gdy podchodzisz do ich drzwi, więc z korytarza do klasy wchodzi się bez ekranu ładowania. Na ścianach wiszą żywe portrety, zbroje odwracają hełmy za przechodzącym.

W zamku żyją uczniowie (chodzą, siadają na ławkach, czytają, rozmawiają w parach, machają na powitanie), woźny na obchodzie, duch Pani Leokadia przenikający przez ściany i Szelma, psotny duch kredy, który rzuca w gracza kredą i zdmuchuje pochodnie (odpędza go każde zaklęcie). Szelma i Pani Leokadia to postacie autorskie tego projektu. Do znalezienia jest 7 stron przewodnika po zamku i sekretne przejście za gobelinem między drugim a trzecim piętrem.

## Lekcje zaklęć

Profesor pokazuje ruch różdżki (prawdziwa animacja i świetlisty ślad), a ten sam ruch rysuje się na tabliczce. Potem gracz rysuje go myszą albo palcem. Rysunek jest próbkowany, normalizowany i porównywany punkt po punkcie ze wzorem (`gestures.js`), z podpowiedziami, gdy ruch jest za krótki albo idzie w przeciwną stronę. Trzy czyste próby podnoszą biegłość zaklęcia (do ★★★), a biegłość wzmacnia zaklęcie w grze: dłuższy Lumos i Protego, mocniejsze Expelliarmus, dłuższa lewitacja.

Lumos i Leviosa: mistrz zaklęć. Protego i Expelliarmus: sala obrony, sala pojedynków i mistrz pojedynków na dziedzińcu. Pozostali profesorowie prowadzą lekcje swoich sal (pytanie i ruch różdżki). Postęp widać w dzienniku (J), w zakładce „Lekcje”.

## Rozmowy, walka i pojedynki

Rozmowy prowadzi filmowa kamera: ujęcia zza ramienia, zbliżenia i plan dwóch postaci z zasadą 180°, głębia ostrości i kinowe pasy. W walce każde zaklęcie ma własny gest, trafienia odrzucają postać, mocny cios ją przewraca, a unik działa w cztery strony. Bartłomiej Wrzos, mistrz pojedynków na dziedzińcu, organizuje pojedynki z Adą, Tymonem i z nim samym.

## Grywalny rozdział

Stwórz ucznia, porozmawiaj z McGonagall, naucz się lewitacji u Flitwicka, unieś trzy kamienie, pokonaj manekiny, spotkaj Hagrida, zapal trzy leśne runy Lumosem, uspokój strażnika i wróć po nagrodę. Zbieraj dittany i skrzynki, warz eliksiry u Snape'a, kupuj je w Hogsmeade, zdobywaj doświadczenie i rozwijaj trzy talenty. Dodatkowe wnętrza atlasu są dostępne do eksploracji i rozmów.

WASD: ruch, Shift: bieg, Alt: unik, PPM i przeciągnięcie: kamera, scroll: odległość, 1–5: zaklęcia, LPM/Spacja: rzut, E: interakcja, R: eliksir, G: wskazówka kierunku, M: mapa, J: dziennik, Esc: pauza. Ekran dotykowy ma przyciski ruchu i czarowania.

## Architektura

- `dist/js/game.js`: pętla gry z krokiem symulacji 1/60 s, kamera, sceny, dialogi, zadania i HUD.
- `dist/js/state.js`: niezależny stan RPG, progresja, statystyki, ekwipunek, kolizje i walidacja zapisu.
- `dist/js/actors.js`: postacie z modelu GLB: warstwy animacji, mimika, wzrok, mowa, LOD.
- `dist/js/camera-rig.js`: kamera eksploracji i filmowa kamera rozmów.
- `dist/js/castle.js`, `dist/js/castle-life.js`: wnętrze zamku do chodzenia i jego mieszkańcy.
- `dist/js/lessons.js`, `dist/js/gestures.js`: lekcje zaklęć i rozpoznawanie narysowanych ruchów.
- `dist/js/duel.js`: pojedynki z postaciami. `dist/js/char-shadows.js`: cienie postaci na żywo.
- `dist/js/effects.js`: pociski, trafienia, tarcza, iskry i proceduralne audio (kroki zależne od podłoża).
- `world.js`, `interiors.js`, `graphics.js`, `environment.js`, `data.js`: kopie bazowych modułów atlasu, rozwijane niezależnie.

Postęp jest zapisywany tylko w tej przeglądarce pod kluczem `hogwarts-rpg-v1`. Atlas ma inny klucz. Sale w zamku łączą się korytarzami; błonia, Hogsmeade i sale poza zamkiem nadal są osobnymi scenami. To fanowski prototyp pierwszego rozdziału, nie kompletna gra AAA ani wierny zamek 1:1. Inne sale mają scenografię, rozmowy i lekcje, ale nie odrębne rozdziały RPG. Animacje są kluczowane w Blenderze, bez motion capture. Świetlista wskazówka wskazuje kierunek; gracz sam omija przeszkody.

## Grafika i licencje

Tryby Płynność / Wysoka / Ultra; rozdzielczość dobierana do ekranu, postprocessing, bloom, odbicia jeziora, tekstury PBR 4K, cienie, mgła, pora dnia. Przy utrzymującej się niskiej liczbie klatek tryb Wysoka automatycznie przechodzi na Płynność. Ultra wybierany ręcznie nie jest automatycznie zmieniany.

Tekstury Poly Haven (CC0), lokalne licencje w `dist/assets`: Three.js (MIT), Cormorant (OFL). Dialogi i zadania są autorskie. Projekt jest nieoficjalną fanowską interpretacją świata Harry'ego Pottera.
