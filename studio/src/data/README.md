# Studio data

Generated, committed, read at build time.

- `tokens.json`: written by `scripts/tokens-model.mjs` from `tokens.css` + `themes/*.css`. Shape: `[{ name, family, dark, light, brands: { <slug>: { dark, light } } }]`.
- `library.json`: written by `scripts/build-library.mjs` from the VERSEVA asset library. Shape: `{ objects, loops, photos, clips }`, each entry carrying its local derivative paths and its release download URLs.
