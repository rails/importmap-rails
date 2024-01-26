require "importmap/jspm_api"

class Importmap::Package
  attr_reader :base_url, :main_url, :package_name

  def initialize(
    package_name:,
    main_url:,
    packager:,
    provider:
  )
    @package_name = package_name
    @main_url = main_url
    @packager = packager
    @provider = provider

    @base_url = extract_base_url_from(main_url)
    @version = extract_package_version_from(@main_url)

    @main_file = main_url[(base_url.size + 1)..]
  end

  def download
    @packager.ensure_vendor_directory_exists
    remove_existing_package_files

    jspm_api = Importmap::JspmApi.new

    files = jspm_api.download(versioned_package_name: "#{@package_name}#{@version}", provider: @provider)

    files.each do |file, downloaded_file|
      save_vendored_file(file, downloaded_file)
    end

    @packager.pin_package_in_importmap(@package_name, vendored_pin)
  end

  def remove
    remove_existing_package_files
    @packager.remove_package_from_importmap(@package_name)
  end

  def vendored_package_folder
    @packager.vendor_path.join(folder_name)
  end

  private
    def vendored_pin
      filename = "#{folder_name}/#{@main_file}"

      %(pin "#{package_name}", to: "#{filename}" # #{@version})
    end

    def save_vendored_file(file, source)
      file_name = vendored_package_path_for_file(file)
      ensure_parent_directories_exist_for(file_name)

      File.open(file_name, "w+") do |vendored_file|
        vendored_file.write "// #{@package_name}#{@version}/#{file} downloaded from #{base_url}/#{file}\n\n"

        vendored_file.write remove_sourcemap_comment_from(source).force_encoding("UTF-8")
      end
    end

    def ensure_parent_directories_exist_for(file)
      dir_name = File.dirname(file)

      unless File.directory?(dir_name)
        FileUtils.mkdir_p(dir_name)
      end
    end

    def remove_sourcemap_comment_from(source)
      source.gsub(/^\/\/# sourceMappingURL=.*/, "")
    end

    def vendored_package_path_for_file(file)
      vendored_package_folder.join(file)
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

    def remove_existing_package_files
      FileUtils.rm_rf vendored_package_folder
    end

    def folder_name
      @package_name.gsub("/", "--")
    end

    def extract_base_url_from(url)
      url.match(/^.+@\d+\.\d+\.\d+/)&.to_a&.first
    end

    def extract_package_version_from(url)
      url.match(/@\d+\.\d+\.\d+/)&.to_a&.first
    end
end
