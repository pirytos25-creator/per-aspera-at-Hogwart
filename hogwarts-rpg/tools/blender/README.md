# Model i animacje postaci (Blender)

Wszystkie postacie w grze korzystają z jednego modelu czarodzieja: `dist/assets/models/wizard.glb`.
Model, szkielet i animacje są w całości generowane skryptami z tego folderu, więc można je zmieniać i przebudować.

| Plik | Co robi |
|---|---|
| `model.py` | Buduje postać: głowę z twarzą, szatę z podszewką w kolorze domu, rękawy, krawat, herb, buty, różdżkę, trzy fryzury (`Hair_Short`, `Hair_Long`, `Hair_Bun`), brodę i kapelusz. Tworzy szkielet (37 kości, w tym łańcuchy szaty i kapelusza) i wagi skóry. |
| `anim.py` | Klatki kluczowe: `idle`, `walk`, `jog`, `run`, `talk`, `cast`, `dodge`. Nogi są liczone odwrotną kinematyką, więc stopy nie ślizgają się po ziemi, a szata i kapelusz poruszają się z opóźnieniem. |
| `export.py` | Eksportuje wszystko do GLB. |
| `preview.py` | Renderuje podglądy (`--action walk --frames 0,6 --views front,side --out /tmp/podglad`). |

## Przebudowa

```
blender -b --python tools/blender/export.py
```

Działa też bez okna Blendera, z modułem `bpy` (Python 3.11): `python tools/blender/export.py`.

## Zasady, na których opiera się gra

- Nazwy materiałów (`M_Skin`, `M_Hair`, `M_Robe`, `M_Lining`, `M_Iris`) gra przemalowuje na kolory z opcji postaci.
- Nazwy obiektów `Hair_*`, `Beard`, `Hat` są włączane i wyłączane opcjami `style`, `beard`, `hat`.
- Kość `wand_tip` wyznacza miejsce, z którego wylatują zaklęcia.
- Każdy cykl ruchu zaczyna się od postawienia lewej pięty. Gra przechowuje wspólną fazę kroku i przesuwa ją o przebyty dystans, dlatego chód, trucht i bieg płynnie przechodzą w siebie.
- `talk` i `cast` są warstwami dodawanymi (additive). Zaczynają się od neutralnej klatki i nakładają na ruch nóg.
