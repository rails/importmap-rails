require "test_helper"

class ImportmapTest < ActiveSupport::TestCase
  def setup
    @importmap = Rails.application.config.importmap
  end

  test "files in app/assets/javascripts" do
    assert_match %r|assets/application-.*\.js|, generate_importmap_json["imports"]["application"]
  end

  test "url references are left unaltered by the configuration" do
    assert_equal "https://cdn.skypack.dev/md5", generate_importmap_json["imports"]["md5"]
  end

  test "missing paths are removed from generated importmap" do
    assert_nil generate_importmap_json["imports"]["not_there"]
  end

  test "preloaded modules are included in preload tags" do
    preloading_module_paths = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers).to_s
    assert_match /md5/, preloading_module_paths
    assert_no_match /application/, preloading_module_paths
  end

  test "cached json" do
    @importmap.cached = true
    assert_nil generate_importmap_json["imports"]["d3"]

    @importmap.pin "d3", to: "https://cdn.jsdelivr.net/npm/d3/+esm"
    assert_nil generate_importmap_json["imports"]["d3"]

    @importmap.cached = false
    assert_equal "https://cdn.jsdelivr.net/npm/d3/+esm", generate_importmap_json["imports"]["d3"]
  ensure
    @importmap.instance_variable_get("@files").delete("d3")
    @importmap.cached = false
  end

  private
    def generate_importmap_json
      JSON.parse @importmap.to_json(resolver: ApplicationController.helpers)
    end
end
