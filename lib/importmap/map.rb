require "pathname"

class Importmap::Map
  attr_reader :packages, :directories

  PIN_REGEX = /^pin\s+["']([^"']+)["']/.freeze # :nodoc:

  def self.pin_line_regexp_for(package) # :nodoc:
    /^.*pin\s+["']#{Regexp.escape(package)}["'].*$/.freeze
  end

  class InvalidFile < StandardError; end

  def initialize
    @integrity = false
    @packages, @directories = {}, {}
    @cache = {}
  end

  def draw(path = nil, &block)
    if path && File.exist?(path)
      begin
        instance_eval(File.read(path), path.to_s)
      rescue StandardError => e
        Rails.logger.error "Unable to parse import map from #{path}: #{e.message}"
        raise InvalidFile, "Unable to parse import map from #{path}: #{e.message}"
      end
    elsif block_given?
      instance_eval(&block)
    end

    self
  end

  # Enables automatic integrity hash calculation for all pinned modules.
  #
  # When enabled, integrity values are included in the importmap JSON for all
  # pinned modules. For local assets served by the Rails asset pipeline,
  # integrity hashes are automatically calculated when +integrity: true+ is
  # specified. For modules with explicit integrity values, those values are
  # included as provided. This provides Subresource Integrity (SRI) protection
  # to ensure JavaScript modules haven't been tampered with.
  #
  # Clears the importmap cache when called to ensure fresh integrity hashes
  # are generated.
  #
  # ==== Examples
  #
  #   # config/importmap.rb
  #   enable_integrity!
  #
  #   # These will now auto-calculate integrity hashes
  #   pin "application"                   # integrity: true by default
  #   pin "admin", to: "admin.js"         # integrity: true by default
  #   pin_all_from "app/javascript/lib"   # integrity: true by default
  #
  #   # Manual control still works
  #   pin "no_integrity", integrity: false
  #   pin "custom_hash", integrity: "sha384-abc123..."
  #
  # ==== Notes
  #
  # * Integrity calculation is disabled by default and must be explicitly enabled
  # * Requires asset pipeline support for integrity calculation (Sprockets or Propshaft 1.2+)
  # * For Propshaft, you must configure +config.assets.integrity_hash_algorithm+
  # * External CDN packages should provide their own integrity hashes
  def enable_integrity!
    clear_cache
    @integrity = true
  end

  def pin(name, to: nil, preload: true, integrity: true)
    clear_cache
    @packages[name] = MappedFile.new(name: name, path: to || "#{name}.js", preload: preload, integrity: integrity)
  end

  def pin_all_from(dir, under: nil, to: nil, preload: true, integrity: true)
    clear_cache
    @directories[dir] = MappedDir.new(dir: dir, under: under, path: to, preload: preload, integrity: integrity)
  end

  # Returns an array of all the resolved module paths of the pinned packages. The `resolver` must respond to
  # `path_to_asset`, such as `ActionController::Base.helpers` or `ApplicationController.helpers`. You'll want to use the
  # resolver that has been configured for the `asset_host` you want these resolved paths to use. In case you need to
  # resolve for different asset hosts, you can pass in a custom `cache_key` to vary the cache used by this method for
  # the different cases.
  def preloaded_module_paths(resolver:, entry_point: "application", cache_key: :preloaded_module_paths)
    preloaded_module_packages(resolver: resolver, entry_point: entry_point, cache_key: cache_key).keys
  end

  # Returns a hash of resolved module paths to their corresponding package objects for all pinned packages
  # that are marked for preloading. The hash keys are the resolved asset paths, and the values are the
  # +MappedFile+ objects containing package metadata including name, path, preload setting, and integrity.
  #
  # The +resolver+ must respond to +path_to_asset+, such as +ActionController::Base.helpers+ or
  # +ApplicationController.helpers+. You'll want to use the resolver that has been configured for the
  # +asset_host+ you want these resolved paths to use.
  #
  # ==== Parameters
  #
  # [+resolver+]
  #   An object that responds to +path_to_asset+ for resolving asset paths.
  #
  # [+entry_point+]
  #   The entry point name or array of entry point names to determine which packages should be preloaded.
  #   Defaults to +"application"+. Packages with +preload: true+ are always included regardless of entry point.
  #   Packages with specific entry point names (e.g., +preload: "admin"+) are only included when that entry
  #   point is specified.
  #
  # [+cache_key+]
  #   A custom cache key to vary the cache used by this method for different cases, such as resolving
  #   for different asset hosts. Defaults to +:preloaded_module_packages+.
  #
  # ==== Returns
  #
  # A hash where:
  # * Keys are resolved asset paths (strings)
  # * Values are +MappedFile+ objects with +name+, +path+, +preload+, and +integrity+ attributes
  #
  # Missing assets are gracefully handled and excluded from the returned hash.
  #
  # ==== Examples
  #
  #   # Get all preloaded packages for the default "application" entry point
  #   packages = importmap.preloaded_module_packages(resolver: ApplicationController.helpers)
  #   # => { "/assets/application-abc123.js" => #<struct name="application", path="application.js", preload=true, integrity=nil>,
  #   #      "https://cdn.skypack.dev/react" => #<struct name="react", path="https://cdn.skypack.dev/react", preload=true, integrity="sha384-..."> }
  #
  #   # Get preloaded packages for a specific entry point
  #   packages = importmap.preloaded_module_packages(resolver: helpers, entry_point: "admin")
  #
  #   # Get preloaded packages for multiple entry points
  #   packages = importmap.preloaded_module_packages(resolver: helpers, entry_point: ["application", "admin"])
  #
  #   # Use a custom cache key for different asset hosts
  #   packages = importmap.preloaded_module_packages(resolver: helpers, cache_key: "cdn_host")
  def preloaded_module_packages(resolver:, entry_point: "application", cache_key: :preloaded_module_packages)
    cache_as(cache_key) do
      expanded_preloading_packages_and_directories(entry_point:).filter_map do |_, package|
        resolved_path = resolve_asset_path(package.path, resolver: resolver)
        next unless resolved_path

        resolved_integrity = resolve_integrity_value(package.integrity, package.path, resolver: resolver)

        package = MappedFile.new(
          name: package.name,
          path: package.path,
          preload: package.preload,
          integrity: resolved_integrity
        )

        [resolved_path, package]
      end.to_h
    end
  end

  # Returns a JSON hash (as a string) of all the resolved module paths of the pinned packages in the import map format.
  # The `resolver` must respond to `path_to_asset`, such as `ActionController::Base.helpers` or
  # `ApplicationController.helpers`. You'll want to use the resolver that has been configured for the `asset_host` you
  # want these resolved paths to use. In case you need to resolve for different asset hosts, you can pass in a custom
  # `cache_key` to vary the cache used by this method for the different cases.
  def to_json(resolver:, cache_key: :json)
    cache_as(cache_key) do
      packages = expanded_packages_and_directories
      map = build_import_map(packages, resolver: resolver)
      JSON.pretty_generate(map)
    end
  end

  # Returns a SHA1 digest of the import map json that can be used as a part of a page etag to
  # ensure that a html cache is invalidated when the import map is changed.
  #
  # Example:
  #
  #   class ApplicationController < ActionController::Base
  #     etag { Rails.application.importmap.digest(resolver: helpers) if request.format&.html? }
  #   end
  def digest(resolver:)
    Digest::SHA1.hexdigest(to_json(resolver: resolver).to_s)
  end

  # Returns an instance of ActiveSupport::EventedFileUpdateChecker configured to clear the cache of the map
  # when the directories passed on initialization via `watches:` have changes. This is used in development
  # and test to ensure the map caches are reset when javascript files are changed.
  def cache_sweeper(watches: nil)
    if watches
      @cache_sweeper =
        Rails.application.config.file_watcher.new([], Array(watches).collect { |dir| [ dir.to_s, "js"] }.to_h) do
          clear_cache
        end
    else
      @cache_sweeper
    end
  end

  private
    MappedDir  = Struct.new(:dir, :path, :under, :preload, :integrity, keyword_init: true)
    MappedFile = Struct.new(:name, :path, :preload, :integrity, keyword_init: true)

    def cache_as(name)
      if result = @cache[name.to_s]
        result
      else
        @cache[name.to_s] = yield
      end
    end

    def clear_cache
      @cache.clear
    end

    def rescuable_asset_error?(error)
      Rails.application.config.importmap.rescuable_asset_errors.any? { |e| error.is_a?(e) }
    end

    def resolve_asset_paths(paths, resolver:)
      paths.transform_values do |mapping|
        resolve_asset_path(mapping.path, resolver:)
      end.compact
    end

    def resolve_asset_path(path, resolver:)
      begin
        resolver.path_to_asset(path)
      rescue => e
        if rescuable_asset_error?(e)
          Rails.logger.warn "Importmap skipped missing path: #{path}"
          nil
        else
          raise e
        end
      end
    end

    def build_import_map(packages, resolver:)
      map = { "imports" => resolve_asset_paths(packages, resolver: resolver) }
      integrity = build_integrity_hash(packages, resolver: resolver)
      map["integrity"] = integrity unless integrity.empty?
      map
    end

    def build_integrity_hash(packages, resolver:)
      packages.filter_map do |name, mapping|
        next unless mapping.integrity

        resolved_path = resolve_asset_path(mapping.path, resolver: resolver)
        next unless resolved_path

        integrity_value = resolve_integrity_value(mapping.integrity, mapping.path, resolver: resolver)
        next unless integrity_value

        [resolved_path, integrity_value]
      end.to_h
    end

    def resolve_integrity_value(integrity, path, resolver:)
      return unless @integrity

      case integrity
      when true
        resolver.asset_integrity(path) if resolver.respond_to?(:asset_integrity)
      when String
        integrity
      end
    end

    def expanded_preloading_packages_and_directories(entry_point:)
      expanded_packages_and_directories.select { |name, mapping| mapping.preload.in?([true, false]) ? mapping.preload : (Array(mapping.preload) & Array(entry_point)).any? }
    end

    def expanded_packages_and_directories
      @packages.dup.tap { |expanded| expand_directories_into expanded }
    end

    def expand_directories_into(paths)
      @directories.values.each do |mapping|
        if (absolute_path = absolute_root_of(mapping.dir)).exist?
          find_javascript_files_in_tree(absolute_path).each do |filename|
            module_filename = filename.relative_path_from(absolute_path)
            module_name     = module_name_from(module_filename, mapping)
            module_path     = module_path_from(module_filename, mapping)

            paths[module_name] = MappedFile.new(
              name: module_name,
              path: module_path,
              preload: mapping.preload,
              integrity: mapping.integrity
            )
          end
        end
      end
    end

    def module_name_from(filename, mapping)
      # Regex explanation:
      # (?:\/|^) # Matches either / OR the start of the string
      # index   # Matches the word index
      # $       # Matches the end of the string
      #
      # Sample matches
      # index
      # folder/index
      index_regex = /(?:\/|^)index$/

      [ mapping.under, filename.to_s.remove(filename.extname).remove(index_regex).presence ].compact.join("/")
    end

    def module_path_from(filename, mapping)
      [ mapping.path || mapping.under, filename.to_s ].compact.reject(&:empty?).join("/")
    end

    def find_javascript_files_in_tree(path)
      Dir[path.join("**/*.js{,m}")].sort.collect { |file| Pathname.new(file) }.select(&:file?)
    end

    def absolute_root_of(path)
      (pathname = Pathname.new(path)).absolute? ? pathname : Rails.root.join(path)
    end
end
