require "thor"
require "importmap/packager"
require "importmap/npm"

class Importmap::Commands < Thor
  include Thor::Actions

  def self.exit_on_failure?
    false
  end

  desc "pin [*PACKAGES]", "Pin new packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  option :preload, type: :string, repeatable: true, desc: "Can be used multiple times"
  option :integrity, type: :boolean, aliases: :i, default: true, desc: "Include integrity hash from JSPM"
  def pin(*packages)
    with_import_response(packages, env: options[:env], from: options[:from], integrity: options[:integrity]) do |imports, integrity_hashes|
      process_imports(imports, integrity_hashes) do |package, url, integrity_hash|
        puts %(Pinning "#{package}" to #{packager.vendor_path}/#{package}.js via download from #{url})

        packager.download(package, url)

        pin = packager.vendored_pin_for(package, url, options[:preload], integrity: integrity_hash)

        log_integrity_usage(integrity_hash)
        update_importmap_with_pin(package, pin)
      end
    end
  end

  desc "unpin [*PACKAGES]", "Unpin existing packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  def unpin(*packages)
    with_import_response(packages, env: options[:env], from: options[:from]) do |imports, _integrity_hashes|
      imports.each do |package, url|
        if packager.packaged?(package)
          puts %(Unpinning and removing "#{package}")
          packager.remove(package)
        end
      end
    end
  end

  desc "pristine", "Redownload all pinned packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  option :integrity, type: :boolean, aliases: :i, default: true, desc: "Include integrity hash from JSPM"
  def pristine
    packages = prepare_packages_with_versions

    with_import_response(packages, env: options[:env], from: options[:from], integrity: options[:integrity]) do |imports, integrity_hashes|
      process_imports(imports, integrity_hashes) do |package, url, integrity_hash|
        puts %(Downloading "#{package}" to #{packager.vendor_path}/#{package}.js from #{url})

        packager.download(package, url)

        log_integrity_usage(integrity_hash)
      end
    end
  end

  desc "json", "Show the full importmap in json"
  def json
    require Rails.root.join("config/environment")
    puts Rails.application.importmap.to_json(resolver: ActionController::Base.helpers)
  end

  desc "audit", "Run a security audit"
  def audit
    vulnerable_packages = npm.vulnerable_packages

    if vulnerable_packages.any?
      table = [["Package", "Severity", "Vulnerable versions", "Vulnerability"]]
      vulnerable_packages.each { |p| table << [p.name, p.severity, p.vulnerable_versions, p.vulnerability] }

      puts_table(table)
      vulnerabilities = 'vulnerability'.pluralize(vulnerable_packages.size)
      severities = vulnerable_packages.map(&:severity).tally.sort_by(&:last).reverse
                                      .map { |severity, count| "#{count} #{severity}" }
                                      .join(", ")
      puts "  #{vulnerable_packages.size} #{vulnerabilities} found: #{severities}"

      exit 1
    else
      puts "No vulnerable packages found"
    end
  end

  desc "outdated", "Check for outdated packages"
  def outdated
    if (outdated_packages = npm.outdated_packages).any?
      table = [["Package", "Current", "Latest"]]
      outdated_packages.each { |p| table << [p.name, p.current_version, p.latest_version || p.error] }

      puts_table(table)
      packages = 'package'.pluralize(outdated_packages.size)
      puts "  #{outdated_packages.size} outdated #{packages} found"

      exit 1
    else
      puts "No outdated packages found"
    end
  end

  desc "update", "Update outdated package pins"
  def update
    if (outdated_packages = npm.outdated_packages).any?
      pin(*outdated_packages.map(&:name))
    else
      puts "No outdated packages found"
    end
  end

  desc "packages", "Print out packages with version numbers"
  def packages
    puts npm.packages_with_versions.map { |x| x.join(' ') }
  end

  desc "integrity [*PACKAGES]", "Download and add integrity hashes for packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  option :update, type: :boolean, aliases: :u, default: false, desc: "Update importmap.rb with integrity hashes"
  def integrity(*packages)
    packages = prepare_packages_with_versions(packages)

    with_import_response(packages, env: options[:env], from: options[:from], integrity: true) do |imports, integrity_hashes|
      process_imports(imports, integrity_hashes) do |package, url, integrity_hash|
        puts %(Getting integrity for "#{package}" from #{url})

        if integrity_hash
          puts %(  #{package}: #{integrity_hash})

          if options[:update]
            pin_with_integrity = packager.pin_for(package, url, integrity: integrity_hash)

            update_importmap_with_pin(package, pin_with_integrity)
            puts %(  Updated importmap.rb with integrity for "#{package}")
          end
        else
          puts %(  No integrity hash available for "#{package}")
        end
      end
    end
  end

  private
    def packager
      @packager ||= Importmap::Packager.new
    end

    def npm
      @npm ||= Importmap::Npm.new
    end

    def update_importmap_with_pin(package, pin)
      if packager.packaged?(package)
        gsub_file("config/importmap.rb", /^pin "#{package}".*$/, pin, verbose: false)
      else
        append_to_file("config/importmap.rb", "#{pin}\n", verbose: false)
      end
    end

    def log_integrity_usage(integrity_hash)
      puts %(  Using integrity: #{integrity_hash}) if integrity_hash
    end

    def handle_package_not_found(packages, from)
      puts "Couldn't find any packages in #{packages.inspect} on #{from}"
    end

    def remove_line_from_file(path, pattern)
      path = File.expand_path(path, destination_root)

      all_lines = File.readlines(path)
      with_lines_removed = all_lines.select { |line| line !~ pattern }

      File.open(path, "w") do |file|
        with_lines_removed.each { |line| file.write(line) }
      end
    end

    def puts_table(array)
      column_sizes = array.reduce([]) do |lengths, row|
        row.each_with_index.map{ |iterand, index| [lengths[index] || 0, iterand.to_s.length].max }
      end

      divider = "|" + (column_sizes.map { |s| "-" * (s + 2) }.join('|')) + '|'
      array.each_with_index do |row, row_number|
        row = row.fill(nil, row.size..(column_sizes.size - 1))
        row = row.each_with_index.map { |v, i| v.to_s + " " * (column_sizes[i] - v.to_s.length) }
        puts "| " + row.join(" | ") + " |"
        puts divider if row_number == 0
      end
    end

    def prepare_packages_with_versions(packages = [])
      if packages.empty?
        npm.packages_with_versions.map do |p, v|
          v.blank? ? p : [p, v].join("@")
        end
      else
        packages
      end
    end

    def process_imports(imports, integrity_hashes, &block)
      imports.each do |package, url|
        integrity_hash = integrity_hashes[url]
        block.call(package, url, integrity_hash)
      end
    end

    def with_import_response(packages, **options)
      response = packager.import(*packages, **options)

      if response
        yield response[:imports], response[:integrity]
      else
        handle_package_not_found(packages, options[:from])
      end
    end
end

Importmap::Commands.start(ARGV)
