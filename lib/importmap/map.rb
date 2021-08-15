class Importmap::Map
  attr_reader :files, :directories

  def initialize
    @files, @directories = {}, {}
  end

  def draw(&block)
    instance_eval(&block)
  end

  def pin(name, to:, preload: false)
    @files[name] = MappedFile.new(name: name, path: to, preload: preload)
  end

  def pin_all_from(path, append_base_path: false, preload: false)
    @directories[path] = MappedDir.new(path: path, append_base_path: append_base_path, preload: preload)
  end

  def preloaded_module_paths(resolver:)
    resolve_asset_paths(resolver).values
  end

  def to_json(resolver:)
    { "imports" => resolve_asset_paths(resolver) }.to_json
  end

  private
    MappedFile = Struct.new(:name, :path, :preload, keyword_init: true)
    MappedDir  = Struct.new(:path, :append_base_path, :preload, keyword_init: true)

    def resolve_asset_paths(resolver)
      expanded_files_and_directories.transform_values do |mapping|
        begin
          resolver.asset_path(mapping.path)
        rescue Sprockets::Rails::Helper::AssetNotFound
          Rails.logger.warn "Importmap skipped missing path: #{mapping.path}"
          nil
        end
      end.compact
    end

    def expanded_files_and_directories
      @files.dup.tap { |expanded| expand_directories_into expanded }
    end

    def expand_directories_into(paths)
      @directories.values.each do |mapping|
        if (absolute_path = absolute_root_of(mapping.path)).exist?
          find_javascript_files_in_tree(absolute_path).each do |filename|
            module_filename = filename.relative_path_from(absolute_path)
            module_name     = module_name_from(module_filename)
            module_path     = mapping.append_base_path ? absolute_path.basename.join(module_filename).to_s : module_filename.to_s

            paths[module_name] = MappedFile.new(name: module_name, path: module_path, preload: mapping.preload)
          end
        end
      end
    end

    # Strip off the extension, /index, or any versioning data for an absolute module name.
    def module_name_from(filename)
      filename.to_s.remove(filename.extname).remove("/index").split("@").first
    end

    def find_javascript_files_in_tree(path)
      Dir[path.join("**/*.js{,m}")].collect { |file| Pathname.new(file) }.select(&:file?)
    end

    def absolute_root_of(path)
      (pathname = Pathname.new(path)).absolute? ? pathname : Rails.root.join(path)
    end
end
