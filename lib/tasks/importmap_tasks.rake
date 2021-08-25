namespace :importmap do
  desc "Setup Importmap for the app"
  task :install do
    system "#{RbConfig.ruby} ./bin/rails app:template LOCATION=#{File.expand_path("../install/install.rb",  __dir__)}"
  end

  desc "Show the importmap"
  task :pins do
    require Rails.root.join("config/environment")
    puts Rails.application.config.importmap.to_json(resolver: ActionController::Base.helpers)
  end
end
