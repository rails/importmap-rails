require "pathname"

class Importmap::Map
  attr_reader :packages, :directories
  attr_accessor :cached

  def initialize
    @packages, @directories = {}, {}
  end

  def draw(path = nil, &block)
    if path && File.exist?(path)
      begin
        instance_eval(File.read(path), path.to_s)
      rescue Exception => e
        Rails.logger.error "Unable to parse import map from #{path}: #{e.message}"
        raise "Unable to parse import map from #{path}: #{e.message}"
      end
    elsif block_given?
      instance_eval(&block)
    end

    self
  end

  def pin(name, to: nil, preload: true)
    @packages[name] = MappedFile.new(name: name, path: to || "#{name}.js", preload: preload)
  end

  def pin_all_from(dir, under: nil, to: nil, preload: true)
    @directories[dir] = MappedDir.new(dir: dir, under: under, path: to, preload: preload)
  end

  def preloaded_module_paths(resolver:)
    cache_as(:preloaded_module_paths) do
      resolve_asset_paths(expanded_preloading_packages_and_directories, resolver: resolver).values
    end
  end

  def to_json(resolver:)
    cache_as(:json) do
      JSON.pretty_generate({ "imports" => resolve_asset_paths(expanded_packages_and_directories, resolver: resolver) })
    end
  end

  private
    MappedDir  = Struct.new(:dir, :path, :under, :preload, keyword_init: true)
    MappedFile = Struct.new(:name, :path, :preload, keyword_init: true)

    def cache_as(name)
      if (cached && result = instance_variable_get("@cached_#{name}"))
        result
      else
        instance_variable_set("@cached_#{name}", yield)
      end
    end

    def resolve_asset_paths(paths, resolver:)
      paths.transform_values do |mapping|
        begin
          resolver.asset_path(mapping.path)
        rescue Sprockets::Rails::Helper::AssetNotFound
          Rails.logger.warn "Importmap skipped missing path: #{mapping.path}"
          nil
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
