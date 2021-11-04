require "thor"
require "importmap/packager"

class Importmap::Commands < Thor
  include Thor::Actions

  def self.exit_on_failure?
    false
  end
  
  desc "pin [*PACKAGES]", "Pin new packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  option :download, type: :boolean, aliases: :d, default: false
  def pin(*packages)
    if imports = packager.import(*packages, env: options[:env], from: options[:from])
      imports.each do |package, url|
        if options[:download]
          puts %(Pinning "#{package}" to #{packager.vendor_path}/#{package}.js via download from #{url})
          packager.download(package, url)
          pin = packager.vendored_pin_for(package, url)
        else
          puts %(Pinning "#{package}" to #{url})
          pin = packager.pin_for(package, url)
        end

        if packager.packaged?(package)
          gsub_file("config/importmap.rb", /^pin "#{package}".*$/, pin, verbose: false)
        else
          append_to_file("config/importmap.rb", "#{pin}\n", verbose: false)
        end
      end
    else
      puts "Couldn't find any packages in #{packages.inspect} on #{options[:from]}"
    end
  end

  desc "unpin [*PACKAGES]", "Unpin existing packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  option :download, type: :boolean, aliases: :d, default: false
  def unpin(*packages)
    if imports = packager.import(*packages, env: options[:env], from: options[:from])
      imports.each do |package, url|
        if packager.packaged?(package)
          if options[:download]
            puts %(Unpinning and removing "#{package}")
          else
            puts %(Unpinning "#{package}")
          end

          packager.remove(package)
        end
      end
    else
      puts "Couldn't find any packages in #{packages.inspect} on #{options[:from]}"
    end
  end

  desc "json", "Show the full importmap in json"
  def json
    require Rails.root.join("config/environment")
    puts Rails.application.importmap.to_json(resolver: ActionController::Base.helpers)
  end

  private
    def packager
      @packager ||= Importmap::Packager.new
    end

    def remove_line_from_file(path, pattern)
      path = File.expand_path(path, destination_root)

      all_lines = File.readlines(path)
      with_lines_removed = all_lines.select { |line| line !~ pattern }

      File.open(path, "w") do |file|
        with_lines_removed.each { |line| file.write(line) }
      end
    end
end

Importmap::Commands.start(ARGV)
