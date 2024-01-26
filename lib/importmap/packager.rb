require "net/http"
require "uri"
require "json"
require "importmap/package"
require "importmap/jspmApi"

class Importmap::Packager
  attr_reader :vendor_path, :importmap_path

  def initialize(importmap_path = "config/importmap.rb", vendor_path: "vendor/javascript")
    @importmap_path = Pathname.new(importmap_path)
    @vendor_path    = Pathname.new(vendor_path)
  end

  def import(*packages, env: "production", from: "jspm")
    jspm_api = Importmap::JspmApi.new

    response = jspm_api.generate(
      install:      Array(packages),
      flatten_scope: true,
      env:          [ "browser", "module", env ],
      provider:     from
    )

    extract_parsed_imports(response, from)
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
      File.write(@importmap_path, "#{pin}\n", mode: "a+")
    end
  end

  def ensure_vendor_directory_exists
    FileUtils.mkdir_p @vendor_path
  end

  private
    def extract_parsed_imports(response, provider)
      imports = response.dig("map", "imports")

      imports&.map do |package, url|
        Importmap::Package.new(
          package_name: package,
          main_url: url,
          packager: self,
          provider:
        )
      end
    end

    def importmap
      @importmap ||= File.read(@importmap_path)
    end
end
