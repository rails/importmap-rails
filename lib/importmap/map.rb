class Importmap::Map
  attr_reader :files, :directories
  attr_accessor :cached

  def initialize
    @files, @directories = {}, {}
  end

  def draw(&block)
    instance_eval(&block)
  end

  def pin(name, to: nil, preload: false)
    @files[name] = MappedFile.new(name: name, path: to || "#{name}.js", preload: preload)
  end

  def pin_all_from(path, under: nil, preload: false)
    @directories[path] = MappedDir.new(path: path, under: under, preload: preload)
  end

  def preloaded_module_paths(resolver:)
    cache_as(:preloaded_module_paths) do
      resolve_asset_paths(expanded_preloading_files_and_directories, resolver: resolver).values
    end
  end

  def to_json(resolver:)
    cache_as(:json) do
      { "imports" => resolve_asset_paths(expanded_files_and_directories, resolver: resolver) }.to_json
    end
  end

  private
    MappedFile = Struct.new(:name, :path, :preload, keyword_init: true)
    MappedDir  = Struct.new(:path, :under, :preload, keyword_init: true)

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

    def expanded_preloading_files_and_directories
      expanded_files_and_directories.select { |name, mapping| mapping.preload }
    end

    def expanded_files_and_directories
      @files.dup.tap { |expanded| expand_directories_into expanded }
    end

    def expand_directories_into(paths)
      @directories.values.each do |mapping|
        if (absolute_path = absolute_root_of(mapping.path)).exist?
          find_javascript_files_in_tree(absolute_path).each do |filename|
            module_filename = filename.relative_path_from(absolute_path)
            module_name     = module_name_from(module_filename, mapping.under)
            module_path     = mapping.under ? absolute_path.basename.join(module_filename).to_s : module_filename.to_s

            paths[module_name] = MappedFile.new(name: module_name, path: module_path, preload: mapping.preload)
          end
        end
      end
    end

    # Strip off the extension, /index, or any versioning data for an absolute module name.
    def module_name_from(filename, under)
      filename_without_ext = filename.to_s.remove(filename.extname)

      if filename_without_ext == "index" && under
        under
      else
        module_name = filename_without_ext.split("@").first
        under ? "#{under}/#{module_name}" : module_name
      end
    end

    def find_javascript_files_in_tree(path)
      Dir[path.join("**/*.js{,m}")].collect { |file| Pathname.new(file) }.select(&:file?)
    end

    def absolute_root_of(path)
      (pathname = Pathname.new(path)).absolute? ? pathname : Rails.root.join(path)
    end
end
