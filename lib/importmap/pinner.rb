require "httparty"

class Importmap::Pinner
  include HTTParty
  base_uri "https://api.jspm.io"

  def pin(*packages, env: "production", from: "jspm")
    fetch_imports(*packages, env: env, provider: from)&.tap do |imports|
      imports.each do |package, url|
        append_to_importmap package, url
      end
    end
  end

  private
    def append_to_importmap(package, url)
      Rails.root.join("config/importmap.rb").open("a") do |config|
        config.puts %(pin "#{package}", to: "#{url}")
      end
    end

    def fetch_imports(*packages, env:, provider:)
      response = self.class.post("/generate", body: {
        "install"      => Array(packages), 
        "flattenScope" => true,
        "env"          => [ "browser", "module", env ],
        "provider"     => provider.to_s
      }.to_json)
      
      response.dig("map", "imports")
    end
end
