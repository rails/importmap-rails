require "active_support"
require "active_support/core_ext/module/delegation"

class Importmap::Reloader
  delegate :execute_if_updated, :execute, :updated?, to: :updater

  def reload!
    import_map_paths.each { |path| Rails.application.importmap.draw(path) }
  end

  private
    def updater
      @updater ||= config.file_watcher.new(import_map_paths) { reload! }
    end

    def import_map_paths
      config.importmap.paths
    end

    def config
      Rails.application.config
    end
end
