# Hogwart — Szlaki Magii

Osobny projekt gry RPG, obok `hogwarts-atlas`. Atlas, jego repozytorium i publikacja nie są modyfikowane.

## Uruchomienie

W katalogu projektu: `npm start`, następnie http://127.0.0.1:4174/. Nie wymaga instalacji pakietów. Wszystkie zasoby Three.js, font i tekstury są lokalne.

`npm run check` sprawdza składnię. `npm test` sprawdza postęp zadań, zapisy, ekwipunek, talenty i kolizje.

## Postacie i animacje

Uczniowie i profesorowie to jeden model z Blendera (`dist/assets/models/wizard.glb`) ze szkieletem i animacjami: spoczynek z oddechem i mruganiem, chód, trucht, bieg, rozmowa z gestami, rzucanie zaklęcia i unik. Szata, kapelusz i włosy mają własny ruch. Kolory domu, fryzura (`style: 'short' | 'long' | 'bun'`), broda i kapelusz ustawia się w opcjach postaci w `game.js`.

Podgląd całej obsady: `postacie.html` (Sala Prób). Skrypty do przebudowy modelu są w `tools/blender/`. Jeśli model się nie wczyta, gra użyje wcześniejszych, prostszych postaci (`actors-proc.js`).

## Grywalny rozdział

Stwórz ucznia, porozmawiaj z McGonagall, naucz się lewitacji u Flitwicka, unieś trzy kamienie, pokonaj manekiny, spotkaj Hagrida, zapal trzy leśne runy Lumosem, uspokój strażnika i wróć po nagrodę. Zbieraj dittany i skrzynki, warz eliksiry u Snape'a, kupuj je w Hogsmeade, zdobywaj doświadczenie i rozwijaj trzy talenty. Dodatkowe wnętrza atlasu są dostępne do eksploracji i rozmów.

WASD: ruch, Shift: bieg, Alt: unik, PPM i przeciągnięcie: kamera, scroll: odległość, 1–5: zaklęcia, LPM/Spacja: rzut, E: interakcja, R: eliksir, G: wskazówka kierunku, M: mapa, J: dziennik, Esc: pauza. Ekran dotykowy ma przyciski ruchu i czarowania.

## Architektura

- `dist/js/game.js`: pętla gry z krokiem symulacji 1/60 s, kamera, sceny, dialogi, zadania i HUD.
- `dist/js/state.js`: niezależny stan RPG, progresja, statystyki, ekwipunek, kolizje i walidacja zapisu.
- `dist/js/actors.js`: postacie z przegubami, animacje chodzenia, rzucania i uniku, modele przeciwników.
- `dist/js/effects.js`: pociski, trafienia, tarcza, iskry i proceduralne audio.
- `world.js`, `interiors.js`, `graphics.js`, `environment.js`, `data.js`: kopie bazowych modułów atlasu, rozwijane niezależnie.

Postęp jest zapisywany tylko w tej przeglądarce pod kluczem `hogwarts-rpg-v1`. Atlas ma inny klucz. Przejścia pomiędzy wnętrzami są zmianami scen. To fanowski prototyp pierwszego rozdziału, nie kompletna gra AAA ani wierny zamek 1:1. Inne sale mają scenografię i rozmowy, ale nie odrębne rozdziały RPG. Animacje są proceduralne, bez motion capture i synchronizacji ust. Świetlista wskazówka wskazuje kierunek; gracz sam omija przeszkody.

## Grafika i licencje

Tryby Płynność / Wysoka / Ultra; rozdzielczość dobierana do ekranu, postprocessing, bloom, odbicia jeziora, tekstury PBR 4K, cienie, mgła, pora dnia. Przy utrzymującej się niskiej liczbie klatek tryb Wysoka automatycznie przechodzi na Płynność. Ultra wybierany ręcznie nie jest automatycznie zmieniany.

Tekstury Poly Haven (CC0), lokalne licencje w `dist/assets`: Three.js (MIT), Cormorant (OFL). Dialogi i zadania są autorskie. Projekt jest nieoficjalną fanowską interpretacją świata Harry'ego Pottera.
