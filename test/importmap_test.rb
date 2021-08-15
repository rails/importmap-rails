require "test_helper"

class ImportmapTest < ActiveSupport::TestCase
  def setup
    @importmap = Importmap::Map.new.tap do |map|
      map.draw do
        pin "application"
        pin "editor", to: "rich_text.js"
        pin "not_there", to: "nowhere.js"
        pin "md5", to: "https://cdn.skypack.dev/md5", preload: true

        pin_all_from "app/assets/javascripts/controllers", under: "controllers", preload: true
      end
    end
  end

  test "local pin with inferred to" do
    assert_match %r|assets/application-.*\.js|, generate_importmap_json["imports"]["application"]
  end

  test "local pin with explicit to" do
    assert_match %r|assets/rich_text-.*\.js|, generate_importmap_json["imports"]["editor"]
  end

  test "local pin missing is removed from generated importmap" do
    assert_nil generate_importmap_json["imports"]["not_there"]
  end

  test "remote pin is not digest stamped" do
    assert_equal "https://cdn.skypack.dev/md5", generate_importmap_json["imports"]["md5"]
  end

  test "directory pin mounted under matching subdir maps all files" do
    assert_match %r|assets/controllers/goodbye_controller-.*\.js|, generate_importmap_json["imports"]["controllers/goodbye_controller"]
  end

  test "directory pin mounted under matching subdir maps index as root" do
    assert_match %r|assets/controllers/index.*\.js|, generate_importmap_json["imports"]["controllers"]
  end

  test "preloaded modules are included in preload tags" do
    preloading_module_paths = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers).to_s
    assert_match /md5/, preloading_module_paths
    assert_match /goodbye_controller/, preloading_module_paths
    assert_no_match /application/, preloading_module_paths
  end

  test "cached json" do
    @importmap.cached = true
    assert_nil generate_importmap_json["imports"]["d3"]

    @importmap.pin "d3", to: "https://cdn.jsdelivr.net/npm/d3/+esm"
    assert_nil generate_importmap_json["imports"]["d3"]

    @importmap.cached = false
    assert_equal "https://cdn.jsdelivr.net/npm/d3/+esm", generate_importmap_json["imports"]["d3"]
  end

  private
    def generate_importmap_json
      JSON.parse @importmap.to_json(resolver: ApplicationController.helpers)
    end
end
