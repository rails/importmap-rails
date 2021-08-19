class Importmap::Reloader
  delegate :execute, :updated?, to: :updater

  def reload!
    config.importmap.clear!
    import_map_paths.each { |path| load path }
  end

  private
    def updater
      @updater ||= ActiveSupport::FileUpdateChecker.new(
        # Reload the importmap when it changes along with the js folder. The js
        # folder needs to trigger a reload so we pick up any new files in
        # pinned directories.
        import_map_paths, javascript_paths
      ) { reload! }
    end

    def import_map_paths
      config.paths["config/importmap.rb"].existent
    end

    def config
      Rails.application.config
    end

    def javascript_paths
      config.paths["app/javascript"].existent.map do |path|
        [path, %w(js)]
      end.to_h
    end
end
