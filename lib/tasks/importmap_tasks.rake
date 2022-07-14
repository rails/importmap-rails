namespace :importmap do
  desc "Setup Importmap for the app"
  task :install do |task|
    namespace = task.name.split(/importmap:install/).first
    system "#{RbConfig.ruby} ./bin/rails #{namespace}app:template LOCATION=#{File.expand_path("../install/install.rb",  __dir__)}"
  end
end
