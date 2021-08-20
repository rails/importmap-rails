class Importmap::Reloader
  delegate :execute, :updated?, to: :updater

  def reload!
    import_map_paths.each { |path| load path }
  end

  private
    def updater
      @updater ||= config.file_watcher.new(import_map_paths) { reload! }
    end

    def import_map_paths
      config.paths["config/importmap.rb"].existent
    end

    def config
      Rails.application.config
    end
end
