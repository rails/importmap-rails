require "importmap/importmap_helper"

module Importmap
  class Engine < ::Rails::Engine
    config.autoload_once_paths = %W( #{root}/app/helpers )

    initializer "importmap.assets" do
      if Rails.application.config.respond_to?(:assets)
        Rails.application.config.assets.precompile += %w( es-module-shims importmap.json )
      end
    end

    initializer "importmap.helpers" do
      ActiveSupport.on_load(:action_controller_base) do
        helper Importmap::ImportmapTagsHelper
      end

      if Rails.application.config.respond_to?(:assets)
        Rails.application.config.assets.configure do |env|
          env.context_class.class_eval { include Importmap::ImportmapHelper }
        end
      end
    end
  end
end
