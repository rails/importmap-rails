require "thor"
require "importmap/packager"

class Importmap::Commands < Thor
  include Thor::Actions
  
  desc "pin [*PACKAGES]", "Pin new packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  def pin(*packages)
    if imports = packager.import(*packages, env: options[:env], from: options[:from])
      imports.each do |package, url|
        pin = packager.pin_for(package, url)

        puts pin

        if packager.packaged?(package)
          gsub_file("config/importmap.rb", /^pin "#{package}".*$/, pin)
        else
          append_to_file("config/importmap.rb", "#{pin}\n")
        end
      end
    else
      puts "Couldn't find any packages in #{packages.inspect} on #{options[:provider]}"
    end
  end

  desc "unpin [*PACKAGES]", "Unpin existing packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  def unpin(*packages)
    if imports = packager.import(*packages, env: options[:env], from: options[:from])
      imports.each do |package, url|
        if packager.packaged?(package)
          gsub_file("config/importmap.rb", /^pin "#{package}".*$/, "")
        end
      end
    else
      puts "Couldn't find any packages in #{packages.inspect} on #{options[:provider]}"
    end
  end

  desc "json", "Show the full importmap in json"
  def json
    puts Rails.application.config.importmap.to_json(resolver: ActionController::Base.helpers)
  end

  private
    def packager
      @packager ||= Importmap::Packager.new
    end
end

Importmap::Commands.start(ARGV)
