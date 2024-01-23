require "net/http"
require "uri"
require "json"
require "importmap/package"

class Importmap::Packager
  Error        = Class.new(StandardError)
  HTTPError    = Class.new(Error)
  ServiceError = Error.new(Error)

  singleton_class.attr_accessor :endpoint
  self.endpoint = URI("https://api.jspm.io/generate")

  attr_reader :vendor_path, :importmap_path

  def initialize(importmap_path = "config/importmap.rb", vendor_path: "vendor/javascript")
    @importmap_path = Pathname.new(importmap_path)
    @vendor_path    = Pathname.new(vendor_path)
  end

  def import(*packages, env: "production", from: "jspm")
    response = post_json({
      "install"      => Array(packages),
      "flattenScope" => true,
      "env"          => [ "browser", "module", env ],
      "provider"     => normalize_provider(from)
    })

    case response.code
    when "200"        then extract_parsed_imports(response)
    when "404", "401" then nil
    else                   handle_failure_response(response)
    end
  end

  def packaged?(package_name)
    importmap.match(/^pin ["']#{package_name}["'].*$/)
  end

  def remove_package_from_importmap(package_name)
    all_lines = File.readlines(@importmap_path)
    with_lines_removed = all_lines.grep_v(/pin ["']#{package_name}["']/)

    File.open(@importmap_path, "w") do |file|
      with_lines_removed.each { |line| file.write(line) }
    end
  end

  def pin_package_in_importmap(package_name, pin)
    if packaged?(package_name)
      gsub_file(@importmap_path, /^pin "#{package_name}".*$/, pin, verbose: false)
    else
      File.write(@importmap_path, "#{pin}\n", mode: 'a+')
    end
  end

  def ensure_vendor_directory_exists
    FileUtils.mkdir_p @vendor_path
  end

  private
    def post_json(body)
      Net::HTTP.post(self.class.endpoint, body.to_json, "Content-Type" => "application/json")
    rescue => error
      raise HTTPError, "Unexpected transport error (#{error.class}: #{error.message})"
    end

    def normalize_provider(name)
      name.to_s == "jspm" ? "jspm.io" : name.to_s
    end

    def extract_parsed_imports(response)
      parsed_response = JSON.parse(response.body)

      imports = parsed_response.dig("map", "imports")
      static_dependencies = parsed_response["staticDeps"] || []
      dynamic_dependencies = parsed_response["dynamicDeps"] || []

      dependencies = static_dependencies + dynamic_dependencies

      imports.map do |package, url|
        Importmap::Package.new(
          unfiltered_dependencies: dependencies,
          package_name: package,
          main_url: url,
          packager: self
        )
      end
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

    def importmap
      @importmap ||= File.read(@importmap_path)
    end
end
