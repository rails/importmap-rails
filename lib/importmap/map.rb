require "pathname"


class Importmap::Map
  attr_reader :packages, :directories, :entry_point

  def initialize(entry_point: nil)
    @entry_point = entry_point || 'application'
    @packages, @directories = {}, {}
  end

  def draw(&block)
    instance_eval(&block)

    self
  end  

  def pin(name, to: nil, preload: false)
    clear_cache
    @packages[name] = MappedFile.new(name: name, path: to || "#{name}.js", preload: preload)
  end

  def pin_all_from(dir, under: nil, to: nil, preload: false)
    clear_cache
    @directories[dir] = MappedDir.new(dir: dir, under: under, path: to, preload: preload)
  end

  # Returns an array of all the resolved module paths of the pinned packages. The `resolver` must respond to `asset_path`,
  # such as `ActionController::Base.helpers` or `ApplicationController.helpers`. You'll want to use the resolver that has
  # been configured for the `asset_host` you want these resolved paths to use. In case you need to resolve for different
  # asset hosts, you can pass in a custom `cache_key` to vary the cache used by this method for the different cases.
  def preloaded_module_paths(resolver:, cache_key: :preloaded_module_paths)
    cache_as(cache_key) do
      resolve_asset_paths(expanded_preloading_packages_and_directories, resolver: resolver).values
    end
  end

  # Returns a JSON hash (as a string) of all the resolved module paths of the pinned packages in the import map format.
  # The `resolver` must respond to `asset_path`, such as `ActionController::Base.helpers` or `ApplicationController.helpers`.
  # You'll want to use the resolver that has been configured for the `asset_host` you want these resolved paths to use.
  # In case you need to resolve for different asset hosts, you can pass in a custom `cache_key` to vary the cache used
  # by this method for the different cases.
  def to_json(resolver:, cache_key: :json)
    cache_as(cache_key) do
      JSON.pretty_generate({ "imports" => resolve_asset_paths(expanded_packages_and_directories, resolver: resolver) })
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

  def clear_cache
    @cached_json = nil
    @cached_preloaded_module_paths = nil
  end

  private
    MappedDir  = Struct.new(:dir, :path, :under, :preload, keyword_init: true)
    MappedFile = Struct.new(:name, :path, :preload, keyword_init: true)

    def cache_as(name)
      if result = instance_variable_get("@cached_#{name}")
        result
      else
        remember_cache_key(name)
        instance_variable_set("@cached_#{name}", yield)
      end
    end

    def remember_cache_key(name)
      @cache_keys ||= Set.new
      @cache_keys.add name
    end


    def clear_cache
      @cache_keys&.each do |name|
        instance_variable_set("@cached_#{name}", nil)
      end
    end

    def rescuable_asset_error?(error)
      Rails.application.config.importmaps.rescuable_asset_errors.any? { |e| error.is_a?(e) }
    end

    def resolve_asset_paths(paths, resolver:)
      paths.transform_values do |mapping|
        begin
          resolver.asset_path(mapping.path)
        rescue => e
          if rescuable_asset_error?(e)
            Rails.logger.warn "Importmap skipped missing path: #{mapping.path}"
            nil
          else
            raise e
          end
        end
      end.compact
    end

    def expanded_preloading_packages_and_directories
      expanded_packages_and_directories.select { |name, mapping| mapping.preload }
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

            paths[module_name] = MappedFile.new(name: module_name, path: module_path, preload: mapping.preload)
          end
        end
      end
    end

    def module_name_from(filename, mapping)
      [ mapping.under, filename.to_s.remove(filename.extname).remove(/\/?index$/).presence ].compact.join("/")
    end

    def module_path_from(filename, mapping)
      [ mapping.path || mapping.under, filename.to_s ].compact.join("/")
    end

    def find_javascript_files_in_tree(path)
      Dir[path.join("**/*.js{,m}")].collect { |file| Pathname.new(file) }.select(&:file?)
    end

    def absolute_root_of(path)
      (pathname = Pathname.new(path)).absolute? ? pathname : Rails.root.join(path)
    end
end
