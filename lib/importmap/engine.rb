require 'importmap/maps'

# Use Rails.application.importmap to access the map
Rails::Application.send(:attr_accessor, :importmaps)

module Importmap
  class Engine < ::Rails::Engine
    config.importmaps = ActiveSupport::OrderedOptions.new
    config.importmaps.paths = []
    config.importmaps.sweep_cache = Rails.env.development? || Rails.env.test?
    config.importmaps.cache_sweepers = []
    config.importmaps.rescuable_asset_errors = []

    config.autoload_once_paths = %W( #{root}/app/helpers )

    initializer "importmaps" do |app|
      app.importmaps = Importmap::Maps.new
      app.config.importmaps.paths << app.root.join("config/importmap.rb")
      app.config.importmaps.paths.each { |path| app.importmaps.draw(path) }
    end

    initializer "importmaps.reloader" do |app|
      Importmap::Reloader.new.tap do |reloader|
        reloader.execute
        app.reloaders << reloader
        app.reloader.to_run { reloader.execute }
      end
    end

    initializer "importmap.cache_sweeper" do |app|
      if app.config.importmaps.sweep_cache
        app.config.importmaps.cache_sweepers << app.root.join("app/javascript")
        app.config.importmaps.cache_sweepers << app.root.join("vendor/javascript")
        app.importmaps.cache_sweeper(watches: app.config.importmaps.cache_sweepers)

        ActiveSupport.on_load(:action_controller_base) do
          before_action { Rails.application.importmaps.cache_sweeper.execute_if_updated }
        end
      end
    end

    initializer "importmaps.assets" do
      if Rails.application.config.respond_to?(:assets)
        Rails.application.config.assets.precompile += %w( es-module-shims.js es-module-shims.min.js )
        Rails.application.config.assets.paths << Rails.root.join("app/javascript")
        Rails.application.config.assets.paths << Rails.root.join("vendor/javascript")
      end
    end

    initializer "importmap.helpers" do
      ActiveSupport.on_load(:action_controller_base) do
        helper Importmap::ImportmapTagsHelper
      end
    end

    initializer 'importmap.rescuable_asset_errors' do |app|
      if defined?(Sprockets::Rails)
        app.config.importmaps.rescuable_asset_errors << Sprockets::Rails::Helper::AssetNotFound
      end
    end
  end
end
