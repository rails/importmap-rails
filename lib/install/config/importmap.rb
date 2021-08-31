# Use Action Cable channels (remember to import "@rails/actionable" in your application.js)
# pin "@rails/actioncable", to: "actioncable.esm.js"
# pin_all_from "app/javascript/channels", under: "channels"

# Use direct uploads for Active Storage (remember to import "@rails/activestorage" in your application.js)
# pin "@rails/activestorage", to: "activestorage.esm.js"

# Pin vendored modules by first adding the following to app/assets/config/manifest.js:
# //= link_tree ../../../vendor/assets/javascripts .js
# pin_all_from "vendor/assets/javascripts"

# JavaScript CDN provider. Also available: :jsdelivr, :esmsh, :unpkg, :skypack
provider :jspm

# Use NPM libraries from CDN
# pin "local-time", version: "2.1.0", file: "app/assets/javascripts/local-time.js"
# pin "vue", version: "2.6.14", file: "dist/vue.esm.browser.js", from: :jsdelivr
# pin "d3", version: "7.0.1", file: "?bundle", from: :esmsh

pin "application"
