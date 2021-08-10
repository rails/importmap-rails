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
JS
end

say "Ensure JavaScript files are in the asset pipeline manifest"
append_to_file Rails.root.join("app/assets/config/manifest.js"), %(//= link_tree ../javascripts)
