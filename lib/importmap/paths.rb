class Importmap::Paths
  attr_reader :paths

  def initialize
    @paths = {}
  end

  def asset(name, path: nil)
    @paths[name] = path || "#{name}.js"
  end

  def assets_in(path)
    if (absolute_path = absolute_root_of(path)).exist?
      find_javascript_files_in_tree(absolute_path).each do |filename|
        module_filename = filename.relative_path_from(absolute_path)
        module_name     = module_name_from(module_filename)
        module_path     = absolute_path.basename.join(module_filename).to_s

        asset module_name, path: module_path
      end
    end
  end

  def to_h
    @paths
  end

  private
    # Strip off the extension and any versioning data for an absolute module name.
    def module_name_from(filename)
      filename.to_s.remove(filename.extname).split("@").first
    end

    def find_javascript_files_in_tree(path)
      Dir[path.join("**/*.js{,m}")].collect { |file| Pathname.new(file) }.select(&:file?)
    end

    def absolute_root_of(path)
      (pathname = Pathname.new(path)).absolute? ? pathname : Rails.root.join(path)
    end
end
