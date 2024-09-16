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
  def pin(*packages)
    if imports = packager.import(*packages, env: options[:env], from: options[:from])
      imports.each do |package, url|
        puts %(Pinning "#{package}" to #{packager.vendor_path}/#{package}.js via download from #{url})
        packager.download(package, url)
        pin = packager.vendored_pin_for(package, url)

        if packager.packaged?(package)
          gsub_file("config/importmap.rb", /^pin "#{package}".*$/, pin, verbose: false)
        else
          append_to_file("config/importmap.rb", "#{pin}\n", verbose: false)
        end
      end
    else
      puts "Couldn't find any packages in #{packages.inspect} on #{options[:from]}"
    end
  end

  desc "unpin [*PACKAGES]", "Unpin existing packages"
  option :env, type: :string, aliases: :e, default: "production"
  option :from, type: :string, aliases: :f, default: "jspm"
  def unpin(*packages)
    if imports = packager.import(*packages, env: options[:env], from: options[:from])
      imports.each do |package, url|
        if packager.packaged?(package)
          puts %(Unpinning and removing "#{package}")
          packager.remove(package)
        end
      end
    else
      puts "Couldn't find any packages in #{packages.inspect} on #{options[:from]}"
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

  private
    def packager
      @packager ||= Importmap::Packager.new
    end

    def npm
      @npm ||= Importmap::Npm.new
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
end

Importmap::Commands.start(ARGV)
