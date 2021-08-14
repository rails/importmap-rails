APPLICATION_LAYOUT_PATH = Rails.root.join("app/views/layouts/application.html.erb")

if APPLICATION_LAYOUT_PATH.exist?
  say "Add Importmap include tags in application layout"
  insert_into_file APPLICATION_LAYOUT_PATH.to_s, "\n    <%= javascript_importmap_tags %>", before: /\s*<\/head>/
else
  say "Default application.html.erb is missing!", :red
  say "        Add <%= javascript_importmap_tags %> within the <head> tag in your custom layout."
end

say "Create application.js module as entrypoint"
create_file Rails.root.join("app/assets/javascripts/application.js") do <<-JS
// Configure your import map in config/initializers/assets.rb

// import "@rails/actioncable"
// import "@rails/activestorage"
JS
end

say "Ensure JavaScript files are in the asset pipeline manifest"
append_to_file Rails.root.join("app/assets/config/manifest.js"), %(//= link_tree ../javascripts .js\n)

say "Configure importmap paths in config/initializers/assets.rb"
append_to_file Rails.root.join("config/initializers/assets.rb") do <<-RUBY

# Configure import map beyond the default of having all files in app/assets/javascripts mapped.
Rails.application.config.importmap.paths.tap do |paths|
  # Match libraries with their NPM package names for possibility of later porting.
  # Ensure that libraries listed in the path have been linked in the asset pipeline manifest or precompiled.
  paths.asset "@rails/actioncable", path: "actioncable.esm.js"
  paths.asset "@rails/activestorage", path: "activestorage.esm.js"
  paths.asset "@rails/actiontext", path: "actiontext.js"
  paths.asset "trix"

  # Use libraries directly from JavaScript CDNs
  # paths.asset "vue", path: "https://cdn.jsdelivr.net/npm/vue@2.6.14/dist/vue.esm.browser.js"
  # paths.asset "d3", path: "https://cdn.skypack.dev/pin/d3@v7.0.0-03vFl9bie0TSesDkWTJV/mode=imports/optimized/d3.js"

  # Map vendored modules by first adding the following to app/assets/config/manifest.js:
  # //= link_tree ../../../vendor/assets/javascripts .js
  # paths.assets_in "vendor/assets/javascripts"
end
RUBY
end
