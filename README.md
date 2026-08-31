# html-extras/core — the library the html-extras elements are built on

A support library. It defines no elements of its own and is not meant to be
used on its own: it holds the pieces every `@html-extras/*` element package is
written against, so that a behaviour lives in one implementation instead of a
copy per package.

## Install

```sh
npm install @html-extras/core
```

```ts
import { ... } from "@html-extras/core";
```

The package ships per-module ES output and its type declarations, so a bundler
takes it apart again and drops what an element does not reach for.

## From a CDN

There is also a single self-contained file, built as a module, for a page that
loads the library straight from a URL. Name it once in an import map and
everything on the page — the components of the family included — reaches it by
the name of the package:

```html
<script type="importmap">
  {
    "imports": {
      "@html-extras/core": "https://cdn.jsdelivr.net/npm/@html-extras/core@1.0.0/dist/cdn/index.esm.js",
      "@html-extras/tabs": "https://cdn.jsdelivr.net/npm/@html-extras/tabs@1.0.0/dist/cdn/index.shared.esm.js"
    }
  }
</script>

<script type="module">
  import "@html-extras/tabs";
  import { cell, watch } from "@html-extras/core";
</script>
```

The core is fetched once, by whoever asks for it first — the components import
it themselves, so a page that only loads components needs no import of its own.

The map has to come before the first module that resolves through it, and both
`unpkg` and `cdn.jsdelivr.net` serve the file with the headers a module is
fetched under. A page that would rather not keep a map can import the same file
by its URL directly.

`@html-extras/*` packages also publish a build with the core inside it, for a
page that loads one of them and arranges nothing at all:

```html
<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/@html-extras/tabs@1.0.0/dist/cdn/index.esm.js"
></script>
```

That build and the one above are alternatives, not layers. A module is the
thing at its URL, so a page that loads the self-contained file and then imports
the core on its own ends up with two cores, each with registries the other
never sees. Pin the versions, keep one URL per package, and that cannot
happen.

## License

[MIT](./LICENSE)
