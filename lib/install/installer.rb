say "Copying Importmap JSON"
directory "#{__dir__}/app/assets/javascripts", "app/assets/javascripts"

APPLICATION_LAYOUT_PATH = Rails.root.join("app/views/layouts/application.html.erb")

if APPLICATION_LAYOUT_PATH.exist?
  say "Add Importmap include tags in application layout"
  insert_into_file Rails.root.join("app/views/layouts/application.html.erb").to_s, "\n    <%= importmap_include_tags %>", before: /\s*<\/head>/
else
  say "Default application.html.erb is missing!", :red
  say "        Add <%= importmap_include_tags %> within the <head> tag in your custom layout."
end
