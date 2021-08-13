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
// import "@rails/actioncable"
// import "@rails/actiontext"
// import "@rails/activestorage"
JS
end

say "Ensure JavaScript files are in the asset pipeline manifest"
append_to_file Rails.root.join("app/assets/config/manifest.js"), %(//= link_tree ../javascripts .js)

say "Configure importmap paths in config/initializers/assets.rb"
append_to_file Rails.root.join("config/initializers/assets.rb") do <<-RUBY

# Configure importmap paths in addition to having all files in app/assets/javascripts mapped.
Rails.application.config.importmap.paths.tap do |paths|
  # Match libraries with their NPM package names for possibility of easy later porting.
  # Ensure that libraries listed in the path have been linked in the asset pipeline manifest or precompiled.
  paths.asset "@rails/actioncable", path: "actioncable.esm.js"
  paths.asset "@rails/activestorage", path: "activestorage.esm.js"
  paths.asset "@rails/actiontext", path: "actiontext.js"
  paths.asset "trix"

  # Make all files in directory available as my_channel => channels/my_channel-$digest.js
  # paths.assets_in "lib/assets/javascripts/channels", append_base_path: true
end
RUBY
end
