# Hogwart — Atlas magicznego świata

Interaktywna, polskojęzyczna wycieczka 3D zbudowana w Three.js. Autorska interpretacja inspirowana filmową architekturą i opisami świata Harry’ego Pottera; nie jest modelem pomiarowym 1:1. Układ części miejsc jest umowny, a profesorowie pochodzą z różnych lat.

## Uruchomienie lokalne

W katalogu projektu uruchom `node server.mjs`, następnie otwórz `http://127.0.0.1:4173`. Node.js jest jedynym wymaganiem narzędziowym. Nie trzeba instalować pakietów. Przeglądarka musi obsługiwać WebGL 2.

Gotową stronę stanowi katalog `dist/`; bibliotekę Three.js i font dołączono lokalnie. Plików ES modules nie należy uruchamiać przez dwuklik `file://` — atlas pokaże wtedy instrukcję zamiast pustego ekranu.

## Zawartość

- Filmowa sylwetka Hogwartu, dziedzińce, wieże z proporcami, kamienny wiadukt i drewniany most.
- Czarne Jezioro z odbiciami i łodziami z latarniami po zmroku, przystań, chatka Hagrida z dymem z komina, las, boisko quidditcha, sowiarnia z sowami, szklarnie, Wierzba Bijąca, Hogsmeade i pociąg parowy na stacji.
- Cztery pory dnia (zmierzch, noc, poranek, dzień) z płynnymi przejściami oraz pogoda: pogodnie, deszcz i śnieg, który osiada na dachach, drzewach i górach.
- 40 wnętrz w 14 rodzinach scenografii. Wielka Sala z zaczarowanym sklepieniem (pokazuje niebo z zewnątrz: chmury za dnia, gwiazdy nocą), unoszącymi się świecami i klepsydrami domów; duchy przenikające przez ściany; smugi światła z okien.
- 21 lekcji z pytaniami i ćwiczeniami gestu różdżką; 8 zaklęć.
- Swobodny lot, spacer po salach, rozmowa z profesorem (klawisz E), trzy wycieczki, zdjęcia, tryb kinowy, generowane dźwięki otoczenia i dziennik w localStorage.

## Sterowanie

| Klawisz | Działanie |
| --- | --- |
| Przeciągnij / scroll / szczypanie | Obrót i przybliżenie (z inercją) |
| Dwuklik | Przybliż wskazane miejsce |
| Ctrl + K lub `/` | Szukaj sal, miejsc, wycieczek, zaklęć i akcji |
| F | Widok z góry ↔ swobodny lot |
| W A S D, Q / E, Shift | Ruch, wysokość w locie, szybciej |
| E (w sali) | Rozmowa z profesorem / wyjście przez drzwi |
| 1–8 | Zaklęcia |
| T / O | Pora dnia / pogoda |
| C | Tryb kinowy bez interfejsu |
| P / M | Zdjęcie / dźwięki |

## Linki i ustawienia

- `#sala/great-hall`, `#miejsce/hogsmeade` — linki prowadzą prosto do sali lub miejsca; przycisk „Kopiuj link” w sali.
- `?q=ultra|high|balanced|low` wymusza jakość, `?pora=noc`, `?pogoda=snow` ustawiają widok startowy.
- Jakość dobiera się automatycznie: atlas startuje w najwyższej i obniża ją, jeśli obraz przestaje być płynny. Ręczny wybór jest zapamiętywany, podobnie jak pora dnia, pogoda i dźwięk.

## Struktura

`dist/js/world.js` — teren, zamek, Hogsmeade, pociąg; `interiors.js` — wnętrza, zaczarowane sklepienie, świece, duchy; `atmosphere.js` — mgła wysokościowa, pory dnia, pogoda, śnieg, gwiazdy, ptaki, proporce, łodzie; `graphics.js` — postprocessing (HDR, cienie kontaktowe, bloom, korekcja barwna) i niebo; `environment.js` — materiały PBR i woda; `audio.js` — generowane dźwięki; `data.js` — miejsca, lekcje i źródła; `app.js` — kamera, interfejs, lekcje i postęp. `dist/style.css` zawiera responsywny interfejs.

Nazwy i realia fikcyjnego świata należą do odpowiednich właścicieli. Projekt fanowski. Geometria jest tworzona proceduralnie, a materiały korzystają z fotograficznych tekstur PBR 4K Poly Haven (CC0); aplikacja nie zawiera kadrów filmowych, cudzych modeli zamku ani filmowej muzyki. Źródła odniesienia dostępne są w aplikacji przez „O atlasie i źródłach”. Three.js: licencja MIT w `dist/assets/THREE-LICENSE.txt`.

Tryb Ultra dodaje HDR, cienie kontaktowe (SSAO), bloom, MSAA 4×, cienie 4096 px i odbicia planarne jeziora. Przełącznik Grafika pozwala obniżyć obciążenie GPU.
