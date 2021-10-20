# frozen_string_literal: true

# This file is called by +lib/tasks/importmap_tasks.rake+.

rails_root = Pathname.new(Rails.root.to_s.split(%r{\/(spec|test)\/dummy}).first)
say "Adding configuration for the importmap-rails gem into: #{rails_root}"

Dir.glob("#{rails_root}/**/application.html.*").each do |layout_path|
  say "Add Importmap include tags in application layout file at #{layout_path}"
  spaces = IO.foreach(layout_path).grep(/(\s*)body/).first.match(/(\s*)/)[1]
  case layout_path.split('.html.').last
  when 'erb'
    insert_into_file layout_path.to_s, "\n#{spaces}  <%= javascript_importmap_tags %>", before: /\s*<\/head>/
  when 'slim'
    insert_into_file layout_path.to_s, "\n#{spaces}  = javascript_importmap_tags", before: /\s*body/
  when 'haml'
    insert_into_file layout_path.to_s, "\n#{spaces}  =javascript_importmap_tags", before: /\s*%body/
  else
    say "Couldn't find an application.html.erb|haml|slim file!", :red
    say "        Add <%= javascript_importmap_tags %> within the <head> tag into your custom layout."
  end
end

say "Create application.js module as entrypoint"
create_file rails_root.join("app/javascript/application.js") do <<-JS
// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
JS
end

say "Use vendor/javascript for downloaded pins"
empty_directory rails_root.join("vendor/javascript")
keep_file rails_root.join("vendor/javascript")

sprockets_manifest_path = rails_root.join("app/assets/config/manifest.js")
if sprockets_manifest_path.exist?
  say "Ensure JavaScript files are in the Sprocket manifest"
  append_to_file sprockets_manifest_path,
    %(//= link_tree ../../javascript .js\n//= link_tree ../../../vendor/javascript .js\n)
end

say "Configure importmap paths in config/importmap.rb"
copy_file "#{__dir__}/config/importmap.rb", rails_root.join("config/importmap.rb")

say "Copying binstub"
copy_file "#{__dir__}/bin/importmap", rails_root.join("bin/importmap")
chmod rails_root.join("bin"), 0755 & ~File.umask, verbose: false
