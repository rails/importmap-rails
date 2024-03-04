class Importmap::JspmApi
  Error        = Class.new(StandardError)
  HTTPError    = Class.new(Error)
  ServiceError = Error.new(Error)

  singleton_class.attr_accessor :generate_endpoint, :download_endpoint
  self.generate_endpoint = "https://api.jspm.io/generate"
  self.download_endpoint = "https://api.jspm.io/download"

  def generate(install:, flatten_scope:, env:, provider:)
    response = post_json(self.class.generate_endpoint, {
      install:,
      flattenScope: flatten_scope,
      env:,
      provider: normalize_provider(provider)
    })

    response_json(response)
  end

  def download(versioned_package_names:, provider:, exclude:)
    response = post_json("#{self.class.download_endpoint}", {
      packages: versioned_package_names,
      provider: normalize_provider(provider),
      exclude:
    })

    json = response_json(response)

    return {} if json.blank?

    json.transform_values do |package_download_details|
      files = package_download_details["files"]
      package_uri = URI(package_download_details["pkgUrl"])

      Net::HTTP.start(package_uri.hostname, { use_ssl: true }) do |http|
        files.map do |file|
          [
            file,
            fetch_file(http, "#{package_uri.path}/#{file}")
          ]
        end.to_h
      end
    end
  end

  private
    def fetch_file(http, path)
      response = http.get(path)

      if response.code == "200"
        response.body
      else
        handle_failure_response(response)
      end
    rescue => error
      raise HTTPError, "Unexpected transport error (#{error.class}: #{error.message})"
    end

    def response_json(response)
      case response.code
      when "200"        then JSON.parse(response.body)
      when "404", "401" then {}
      else                   handle_failure_response(response)
      end
    end

    def normalize_provider(name)
      name.to_s == "jspm" ? "jspm.io" : name.to_s
    end

    def post_json(endpoint, body)
      Net::HTTP.post(URI(endpoint), body.to_json, "Content-Type" => "application/json")
    rescue => error
      raise HTTPError, "Unexpected transport error (#{error.class}: #{error.message})"
    end

    def handle_failure_response(response)
      if error_message = parse_service_error(response)
        raise ServiceError, error_message
      else
        raise HTTPError, "Unexpected response code (#{response.code})"
      end
    end

    def parse_service_error(response)
      JSON.parse(response.body.to_s)["error"]
    rescue JSON::ParserError
      nil
    end
end
