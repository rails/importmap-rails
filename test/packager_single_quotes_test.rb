require "test_helper"
require "importmap/packager"

class Importmap::PackagerSingleQuotesTest < ActiveSupport::TestCase
  setup do
    @single_quote_config_name = Rails.root.join("config/importmaps/single_quotes.rb")
    FileUtils.mkdir_p @single_quote_config_name.dirname
    File.write(@single_quote_config_name, File.read(Rails.root.join("config/importmap.rb")).tr('"', "'"))
    Dir.chdir(Rails.root)
    @packager = Importmap::Packager.new("single_quotes")
  end

  teardown { File.delete(@single_quote_config_name) }

  test "packaged? with single quotes" do
    assert @packager.packaged?("md5")
    assert_not @packager.packaged?("md5-extension")
  end

  test "remove package with single quotes" do
    assert @packager.remove("md5")
    assert_not @packager.packaged?("md5")
  end
end
