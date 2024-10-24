require "net/http"
require "uri"
require "json"

class Importmap::Packager
  Error        = Class.new(StandardError)
  HTTPError    = Class.new(Error)
  ServiceError = Error.new(Error)

  singleton_class.attr_accessor :endpoint
  self.endpoint = URI("https://api.jspm.io/generate")

  attr_reader :vendor_path

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

  def pin_for(package, url)
    %(pin "#{package}", to: "#{url}")
  end

  def vendored_pin_for(package, url)
    filename = package_filename(package)
    version  = extract_package_version_from(url)
    line_formatted_pin_options = pin_options_for_package(package).except("to").map { |option, value| %(#{option}: #{value.is_a?(String) ? %("#{value}") : value}) }
    pin_components = [
      %(pin "#{package}"),
      (%(to: "#{filename}") unless "#{package}.js" == filename),
      *line_formatted_pin_options
    ].compact

    %(#{pin_components.join(", ")} # #{version})
  end

  def packaged?(package)
    package_line_in_importmap(package).present?
  end

  def download(package, url)
    ensure_vendor_directory_exists
    remove_existing_package_file(package)
    download_package_file(package, url)
  end

  def remove(package)
    remove_existing_package_file(package)
    remove_package_from_importmap(package)
  end

  def pin_options_for_package(package)
    line = package_line_in_importmap(package) || ""
    raw_options = line.match(/^#{base_package_line_regex(package)}?,[\s+]?(?<pin_options>.*) #.*$/)

    return {} if raw_options.blank?

    raw_options[:pin_options].split(/,\s|,/).each_with_object({}) do |option, hash|
      match_data = option.match(/^(?<option_name>[^:]*):[\s+]?["']?(?<option_value>.*[^"'])["']?$/)

      hash[match_data[:option_name]] = cast_option_value(match_data[:option_value])
    end
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
      JSON.parse(response.body).dig("map", "imports")
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


    def ensure_vendor_directory_exists
      FileUtils.mkdir_p @vendor_path
    end

    def remove_existing_package_file(package)
      FileUtils.rm_rf vendored_package_path(package)
    end

    def remove_package_from_importmap(package)
      all_lines = File.readlines(@importmap_path)
      with_lines_removed = all_lines.grep_v(/pin ["']#{package}["']/)

      File.open(@importmap_path, "w") do |file|
        with_lines_removed.each { |line| file.write(line) }
      end
    end

    def download_package_file(package, url)
      response = Net::HTTP.get_response(URI(url))

      if response.code == "200"
        save_vendored_package(package, url, response.body)
      else
        handle_failure_response(response)
      end
    end

    def save_vendored_package(package, url, source)
      File.open(vendored_package_path(package), "w+") do |vendored_package|
        vendored_package.write "// #{package}#{extract_package_version_from(url)} downloaded from #{url}\n\n"

        vendored_package.write remove_sourcemap_comment_from(source).force_encoding("UTF-8")
      end
    end

    def remove_sourcemap_comment_from(source)
      source.gsub(/^\/\/# sourceMappingURL=.*/, "")
    end

    def vendored_package_path(package)
      @vendor_path.join(package_filename(package))
    end

    def package_filename(package)
      package.gsub("/", "--") + ".js"
    end

    def extract_package_version_from(url)
      url.match(/@\d+\.\d+\.\d+/)&.to_a&.first
    end

    def package_line_in_importmap(package)
      importmap.match(/^#{base_package_line_regex(package)}.*$/).try(:[], 0)
    end

    def base_package_line_regex(package)
      /pin ["']#{package}["']/
    end

    def cast_option_value(object)
      return true if object == "true"
      return false if object == "false"

      object
    end
end
