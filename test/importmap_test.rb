require "test_helper"

class ImportmapTest < ActiveSupport::TestCase
  def setup
    @importmap = Importmap::Map.new.tap do |map|
      map.draw do
        pin "application"
        pin "editor", to: "rich_text.js"
        pin "not_there", to: "nowhere.js"
        pin "md5", to: "https://cdn.skypack.dev/md5", preload: true

        pin_all_from "app/javascript/controllers", under: "controllers", preload: true
        pin_all_from "app/javascript/spina/controllers", under: "controllers/spina", preload: true
        pin_all_from "app/javascript/spina/controllers", under: "controllers/spina", to: "spina/controllers", preload: true
        pin_all_from "app/javascript/helpers", under: "helpers", preload: true
        pin_all_from "lib/assets/javascripts", preload: true
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
    assert_match %r|assets/controllers/utilities/md5_controller-.*\.js|, generate_importmap_json["imports"]["controllers/utilities/md5_controller"]
  end

  test "directory pin mounted under matching subdir maps index as root" do
    assert_match %r|assets/controllers/index.*\.js|, generate_importmap_json["imports"]["controllers"]
  end

  test "directory pin mounted under matching subdir maps index as root at second depth" do
    assert_match %r|assets/helpers/requests/index.*\.js|, generate_importmap_json["imports"]["helpers/requests"]
  end

  test "directory pin under custom asset path" do
    assert_match %r|assets/spina/controllers/another_controller-.*\.js|, generate_importmap_json["imports"]["controllers/spina/another_controller"]
    assert_match %r|assets/spina/controllers/deeper/again_controller-.*\.js|, generate_importmap_json["imports"]["controllers/spina/deeper/again_controller"]
  end

  test "directory pin without path or under" do
    assert_match %r|assets/my_lib-.*\.js|, generate_importmap_json["imports"]["my_lib"]
  end

  test 'invalid importmap file results in error' do
    file = file_fixture('invalid_import_map.rb')
    importmap = Importmap::Map.new
    assert_raises Importmap::Map::InvalidFile do
      importmap.draw(file)
    end
  end

  test "preloaded modules are included in preload tags" do
    preloading_module_paths = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers).to_s
    assert_match /md5/, preloading_module_paths
    assert_match /goodbye_controller/, preloading_module_paths
    assert_no_match /application/, preloading_module_paths
  end

  test "digest" do
    assert_match /^\w{40}$/, @importmap.digest(resolver: ApplicationController.helpers)
  end

  test "separate caches" do
    set_one = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers, cache_key: "1").to_s

    ActionController::Base.asset_host = "http://assets.example.com"

    set_two = @importmap.preloaded_module_paths(resolver: ActionController::Base.helpers, cache_key: "2").to_s

    assert_not_equal set_one, set_two
  ensure
    ActionController::Base.asset_host = nil
  end

  test "all caches reset" do
    set_one = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers, cache_key: "1").to_s
    set_two = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers, cache_key: "2").to_s

    @importmap.pin "something", to: "https://cdn.example.com/somewhere.js", preload: true

    assert_not_equal set_one, @importmap.preloaded_module_paths(resolver: ApplicationController.helpers, cache_key: "1").to_s
    assert_not_equal set_two, @importmap.preloaded_module_paths(resolver: ApplicationController.helpers, cache_key: "2").to_s
  end

  private
    def generate_importmap_json
      JSON.parse @importmap.to_json(resolver: ApplicationController.helpers)
    end
end
