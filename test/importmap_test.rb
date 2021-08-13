require "test_helper"

class ImportmapTest < ActiveSupport::TestCase
  test "files in app/assets/javascripts show up in importmap by default" do
    assert_match %r|assets/application-.*\.js|, generate_importmap_json["imports"]["application"]
  end

  test "files in lib/assets/javascripts show up in importmap by configuration" do
    assert_match %r|assets/my_lib-.*\.js|, generate_importmap_json["imports"]["my_lib"]
  end

  test "url references are left unaltered by the configuration" do
    assert_equal "https://cdn.skypack.dev/md5", generate_importmap_json["imports"]["md5"]
  end

  test "missing paths are removed from generated importmap" do
    assert_nil generate_importmap_json["imports"]["not_there"]
  end

  private
    def generate_importmap_json
      JSON.parse Rails.application.config.importmap.paths.to_json(ApplicationController.helpers)
    end
end
