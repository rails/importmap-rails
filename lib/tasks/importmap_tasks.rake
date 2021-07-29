namespace :importmap do
  desc "Install Importmap into the app"
  task :install do
    system "#{RbConfig.ruby} ./bin/rails app:template LOCATION=#{File.expand_path("../install/installer.rb",  __dir__)}"
  end
end
