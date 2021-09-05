require "net/http"
require "uri"
require "json"
require "minitest/mock"

class Importmap::Packager
  Error = Class.new(StandardError)
  HTTPError = Class.new(Error)
  ServiceError = Error.new(Error)

  singleton_class.attr_accessor :endpoint
  self.endpoint = URI("https://api.jspm.io/generate")

  def initialize(importmap_path = "config/importmap.rb")
    @importmap_path = importmap_path
  end

  def import(*packages, env: "production", from: "jspm")
    response = post_json({
      "install"      => Array(packages), 
      "flattenScope" => true,
      "env"          => [ "browser", "module", env ],
      "provider"     => from.to_s,
    })

    case response.code
    when "200"
      JSON.parse(response.body).dig("map", "imports")
    when "404", "401" # 401 is returned on package not found
      nil
    else
      if error_message = parse_service_error(response)
        raise ServiceError, error_message
      else
        raise HTTPError, "Unexpected response code (#{response.code})"
      end
    end
  end

  def pin_for(package, url)
    %(pin "#{package}", to: "#{url}")
  end

  def packaged?(package)
    importmap.match(/^pin "#{package}".*$/)
  end

  private
    def parse_service_error(response)
      return unless response.body

      json_error = begin
        JSON.parse(response.body)
      rescue JSON::ParserError
        return
      end

      return unless json_error.is_a?(Hash)
      json_error["error"]
    end

    def post_json(body)
      json_body = body.to_json

      begin
        Net::HTTP.post(self.class.endpoint, json_body, { "Content-Type" => "application/json" })
      rescue => error
        raise HTTPError, "Unexpected transport error (#{error.class}: #{error.message})"
      end
    end

    def importmap
      @importmap ||= File.read(@importmap_path)
    end
end
