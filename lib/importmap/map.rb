class Importmap::Map
  attr_reader :files, :directories

  def initialize
    @files, @directories = {}, {}
  end

  def draw(&block)
    instance_eval(&block)
  end

  def pin(name, to:)
    @files[name] = to
  end

  def pin_all_from(path, append_base_path: false)
    @directories[path] = append_base_path
  end

  def to_json(resolver)
  def to_json(resolver:)
    { "imports" => resolve_asset_paths(resolver) }.to_json
  end

  private
    def resolve_asset_paths(resolver)
      expanded_files_and_directories.transform_values do |path|
        begin
          resolver.asset_path(path)
        rescue Sprockets::Rails::Helper::AssetNotFound
          Rails.logger.warn "Importmap skipped missing path: #{path}"
          nil
        end
      end.compact
    end

    def expanded_files_and_directories
      @files.dup.tap { |expanded| expand_directories_into expanded }
    end

    def expand_directories_into(paths)
      @directories.each do |(path, append_base_path)|
        if (absolute_path = absolute_root_of(path)).exist?
          find_javascript_files_in_tree(absolute_path).each do |filename|
            module_filename = filename.relative_path_from(absolute_path)
            module_name     = module_name_from(module_filename)
            module_path     = append_base_path ? absolute_path.basename.join(module_filename).to_s : module_filename.to_s

            paths[module_name] = module_path
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
