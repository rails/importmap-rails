require "httparty"
require "minitest/mock"

class Importmap::Packager
  include HTTParty
  base_uri "https://api.jspm.io"

  def initialize(importmap_path = "config/importmap.rb")
    @importmap_path = importmap_path
  end

  def import(*packages, env: "production", from: "jspm")
    response = self.class.post("/generate", body: {
      "install"      => Array(packages), 
      "flattenScope" => true,
      "env"          => [ "browser", "module", env ],
      "provider"     => from.to_s
    }.to_json)
    
    case response.code
    when 200 then response.dig("map", "imports")
    when 404 then nil
    else          response.send(:throw_exception)
    end
  end

  def pin_for(package, url)
    %(pin "#{package}", to: "#{url}")
  end

  def packaged?(package)
    importmap.match(/^pin "#{package}".*$/)
  end

  private
    def importmap
      @importmap ||= File.read(@importmap_path)
    end
end
