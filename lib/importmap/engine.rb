require "importmap/map"

# Use Rails.application.importmap to access the map
Rails::Application.send(:attr_accessor, :importmap)

module Importmap
  class Engine < ::Rails::Engine
    config.importmap = ActiveSupport::OrderedOptions.new
    config.importmap.sweep_cache = Rails.env.development? || Rails.env.test?
    config.importmap.rescuable_asset_errors = []

    config.autoload_once_paths = %W( #{root}/app/helpers )

    initializer "importmap" do |app|
      app.importmap = Importmap::Map.new.draw("config/importmap.rb")
    end

    initializer "importmap.reloader" do |app|
      app.config.paths.add "config/importmap.rb"

      Importmap::Reloader.new.tap do |reloader|
        reloader.execute
        app.reloaders << reloader
        app.reloader.to_run { reloader.execute }
      end
    end

    initializer "importmap.cache_sweeper" do |app|
      if app.config.importmap.sweep_cache
        app.importmap.cache_sweeper watches: [ 
          app.root.join("app/javascript"), app.root.join("vendor/javascript")
        ]

        ActiveSupport.on_load(:action_controller_base) do
          before_action { Rails.application.importmap.cache_sweeper.execute_if_updated }
        end
      end
    end

    initializer "importmap.assets" do
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
        app.config.importmap.rescuable_asset_errors << Sprockets::Rails::Helper::AssetNotFound
      end
    end
  end
end
