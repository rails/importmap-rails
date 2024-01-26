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

  def download(versioned_package_name:, provider:)
    response = post_json("#{self.class.download_endpoint}/#{versioned_package_name}", {
      provider: normalize_provider(provider)
    })

    json = response_json(response)

    files = json.dig(versioned_package_name, "files")
    package_url = json.dig(versioned_package_name, "pkgUrl")

    output_files = {}

    files.each do |file|
      output_files[file] = fetch_file(package_url, file)
    end

    output_files
  end

  private
    def fetch_file(url, file)
      response = Net::HTTP.get_response(URI("#{url}#{file}"))

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
