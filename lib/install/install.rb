APPLICATION_LAYOUT_PATH = Rails.root.join("app/views/layouts/application.html.erb")

if APPLICATION_LAYOUT_PATH.exist?
  say "Add Importmap include tags in application layout"
  insert_into_file APPLICATION_LAYOUT_PATH.to_s, "\n    <%= javascript_importmap_tags %>", before: /\s*<\/head>/
else
  say "Default application.html.erb is missing!", :red
  say "        Add <%= javascript_importmap_tags %> within the <head> tag in your custom layout."
end

say "Create application.js module as entrypoint"
create_file Rails.root.join("app/javascript/application.js") do <<-JS
// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
JS
end

say "Ensure JavaScript files are in the asset pipeline manifest"
append_to_file Rails.root.join("app/assets/config/manifest.js"), %(//= link_tree ../../javascript .js\n)

say "Configure importmap paths in config/importmap.rb"
create_file Rails.root.join("config/importmap.rb") do <<-RUBY
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
RUBY
end
