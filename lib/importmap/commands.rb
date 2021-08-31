require "thor"
require "importmap/pinner"

class Importmap::Commands < Thor
  desc "pin [*PACKAGES]", "Pin new packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  def pin(*packages)
    if imports = Importmap::Pinner.new.pin(*packages, env: options[:env], from: options[:from])
      imports.each do |package, url|
        puts "Pinned '#{package}' to #{url}"
      end
    else
      puts "Couldn't find any packages in #{packages.inspect} on #{options[:provider]}"
    end
  end

  desc "json", "Show the full importmap in json"
  def json
    puts Rails.application.config.importmap.to_json(resolver: ActionController::Base.helpers)
  end
end

Importmap::Commands.start(ARGV)
