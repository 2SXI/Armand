# Web framework: Bootstrap 5.3.3

The customer account pages (`account.html`) are built with **Bootstrap 5.3.3**, self-hosted
(no CDN, so the site's Content-Security-Policy stays strict):

| File | What it is |
|---|---|
| `bootstrap-scoped.css` | Bootstrap's grid, forms, buttons, tabs, cards, alerts, badges and utilities, compiled from Bootstrap's own Sass |
| `bootstrap.bundle.min.js` | Bootstrap's JavaScript (the tabs component) |
| `tools/bootstrap-scoped.scss` | The build recipe |

**Why "scoped"?** Normal Bootstrap resets the styling of the whole page and would change the look of
the existing, hand-designed pages. This build puts every rule under a `.bs` wrapper, so Bootstrap only
affects the account page content. The header, footer and other pages are untouched.

**Bootstrap features used:** responsive 12-column grid (`container`, `row`, `col-md-6`, `col-lg-5`),
form controls and validation states (`form-control`, `is-invalid`), accessible tabs (`nav-tabs`,
`data-bs-toggle="tab"`), alerts, cards and badges for orders, buttons, dark colour mode.

**To rebuild:**
```
npm i bootstrap@5.3.3 sass
npx sass --load-path=node_modules --style=compressed tools/bootstrap-scoped.scss bootstrap-scoped.css
```
then replace `.bs :root` with `.bs` and `.bs [data-bs-theme=dark]` with
`.bs[data-bs-theme=dark],.bs [data-bs-theme=dark]` in the output.

Bootstrap is MIT licensed (c) The Bootstrap Authors.
