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

say "Use vendor/javascript for downloaded pins"
empty_directory "vendor/javascript"
keep_file "vendor/javascript"

if (sprockets_manifest_path = Rails.root.join("app/assets/config/manifest.js")).exist?
  say "Ensure JavaScript files are in the Sprocket manifest"
  append_to_file sprockets_manifest_path,
    %(//= link_tree ../../javascript .js\n//= link_tree ../../../vendor/javascript .js\n)
end

say "Configure importmap paths in config/importmap.rb"
copy_file "#{__dir__}/config/importmap.rb", "config/importmap.rb"

say "Copying binstub"
copy_file "#{__dir__}/bin/importmap", "bin/importmap"
chmod "bin", 0755 & ~File.umask, verbose: false
