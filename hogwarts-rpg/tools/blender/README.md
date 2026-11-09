# Model i animacje postaci (Blender)

Wszystkie postacie w grze korzystają z jednego modelu czarodzieja: `dist/assets/models/wizard.glb`.
Model, szkielet i animacje są w całości generowane skryptami z tego folderu, więc można je zmieniać i przebudować.

| Plik | Co robi |
|---|---|
| `model.py` | Buduje postać: głowę z oczami, powiekami, rzęsami, brwiami, ustami i zębami, szatę z podszewką w kolorze domu, dłonie z palcami, różdżkę, książkę, pięć fryzur (`Hair_Short`, `Hair_Long`, `Hair_Bun`, `Hair_Pony`, `Hair_Curly`), brodę i kapelusz. Dodaje kształty mimiki (`smile`, `frown`, `browUp`, `browAngry`, `browSad`, `mouthO`, `mouthWide`, `squint`) i rysów twarzy (`faceSoft`, `faceOld`, `faceBroad`, `faceNose`), kości twarzy (`jaw`, `lid.L/R`, `eye.L/R`) i wypieka cieniowanie (AO) do kolorów wierzchołków. |
| `anim.py` | Ruch podstawowy: `idle`, `walk`, `jog`, `run`, `talk`, `cast`, `dodge`. Nogi są liczone odwrotną kinematyką, więc stopy nie ślizgają się po ziemi, a szata i kapelusz poruszają się z opóźnieniem. Na końcu dołącza `anim2.py`. |
| `anim2.py` | Pozostałe animacje: kroki w bok, gesty zaklęć (`spell_raise`, `spell_swish`, `spell_shield`, `spell_slash`, `spell_circle`, `spell_zigzag`), gesty rozmowy, trafienia, upadek, leżenie i wstawanie, uniki w cztery strony, siadanie, czytanie, ukłon. Razem 36 animacji. |
| `export.py` | Tworzy lżejsze kopie `*_LOD1` i eksportuje wszystko do GLB z kształtami mimiki i kolorami wierzchołków. |
| `build.sh` | Pełna przebudowa: eksport, przepróbkowanie animacji i kompresja meshopt (`@gltf-transform/cli`). |
| `preview.py` | Renderuje podglądy (`--action walk --frames 0,6 --views front,side --out /tmp/podglad`, `--face`, `--keys smile=1`, `--pose jaw=.1`). |

## Przebudowa

```
bash tools/blender/build.sh
```

Sam eksport bez kompresji: `blender -b --python tools/blender/export.py`.

Działa też bez okna Blendera, z modułem `bpy` (Python 3.11): `python tools/blender/export.py`.

## Zasady, na których opiera się gra

- Nazwy materiałów (`M_Skin`, `M_Hair`, `M_Robe`, `M_Lining`, `M_Iris`) gra przemalowuje na kolory z opcji postaci.
- Nazwy obiektów `Hair_*`, `Beard`, `Hat` są włączane i wyłączane opcjami `style`, `beard`, `hat`.
- Kość `wand_tip` wyznacza miejsce, z którego wylatują zaklęcia.
- Każdy cykl ruchu zaczyna się od postawienia lewej pięty. Gra przechowuje wspólną fazę kroku i przesuwa ją o przebyty dystans, dlatego chód, trucht i bieg płynnie przechodzą w siebie.
- `talk`, `cast` i gesty są warstwami dodawanymi (additive) liczonymi względem klipu `ref`, więc nakładają się na ruch nóg.
- Kości `jaw`, `lid.*`, `eye.*` i `pony` nie mają klatek kluczowych: steruje nimi gra (mowa, mruganie, wzrok, ruch kucyka).
- Postacie są rysowane na osobnej warstwie (`ACTOR_LAYER` w `actors.js`), dzięki czemu mają własne cienie na żywo.
