# Configure Rails Environment
ENV["RAILS_ENV"] = "test"

require_relative "../test/dummy/config/environment"
ActiveRecord::Migrator.migrations_paths = [File.expand_path("../test/dummy/db/migrate", __dir__)]
ActiveRecord::Migrator.migrations_paths << File.expand_path('../db/migrate', __dir__)
require "rails/test_help"


# Load fixtures from the engine
if ActiveSupport::TestCase.respond_to?(:fixture_path=)
  ActiveSupport::TestCase.fixture_path = File.expand_path("fixtures", __dir__)
  ActionDispatch::IntegrationTest.fixture_path = ActiveSupport::TestCase.fixture_path
  ActiveSupport::TestCase.file_fixture_path = ActiveSupport::TestCase.fixture_path + "/files"
  ActiveSupport::TestCase.fixtures :all
end

MockResolver = Struct.new(:accept) do
  def path_to_asset(path)
    if source = source_file(path)
      digest = Digest::SHA256.hexdigest(source.mtime.to_s)
      "/assets/" + path.sub(/\.js\z/, "-#{digest}.js")
    else
      ApplicationController.helpers.asset_path(path)
    end
  end

  def root
    Rails.root.join('app', 'javascript')
  end

  def source_file(path)
    accept.map { |ext| root.join("#{path.remove(/\.js\z/)}.#{ext}") }.detect(&:file?)
  end
end
