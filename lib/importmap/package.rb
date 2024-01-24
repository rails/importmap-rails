class Importmap::Package
  attr_reader :base_url, :main_url, :package_name

  def initialize(
    unfiltered_dependencies:,
    package_name:,
    main_url:,
    packager:
  )
    @unfiltered_dependencies = unfiltered_dependencies
    @package_name = package_name
    @main_url = main_url
    @packager = packager

    @base_url = extract_base_url_from(main_url)

    dependencies = unfiltered_dependencies.select { _1.start_with?(base_url) }
    @dependency_files = dependencies.map { _1[(base_url.size + 1)..] } # @main_file is included in this list

    @main_file = main_url[(base_url.size + 1)..]
  end

  def download
    @packager.ensure_vendor_directory_exists
    remove_existing_package_files

    @dependency_files.each do |file|
      download_file(file)
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
      filename = "#{package_name}/#{@main_file}"
      version  = extract_package_version_from(@main_url)

      %(pin "#{package_name}", to: "#{filename}" # #{version})
    end

    def download_file(file)
      response = Net::HTTP.get_response(URI("#{base_url}/#{file}"))

      if response.code == "200"
        save_vendored_file(file, response.body)
      else
        handle_failure_response(response)
      end
    end

    def save_vendored_file(file, source)
      url = "#{base_url}/#{file}"
      file_name = vendored_package_path_for_file(file)
      ensure_parent_directories_exist_for(file_name)
      File.open(file_name, "w+") do |vendored_file|
        vendored_file.write "// #{package_name}#{extract_package_version_from(url)}/#{file} downloaded from #{url}\n\n"

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
