require "test_helper"

class ImportmapTest < ActiveSupport::TestCase
  def setup
    @importmap = Importmap::Map.new.tap do |map|
      map.draw do
        pin "application", preload: false
        pin "editor", to: "rich_text.js", preload: false
        pin "not_there", to: "nowhere.js", preload: false
        pin "md5", to: "https://cdn.skypack.dev/md5"

        provider :jspm

        pin "react", version: "17.0.0", file: "index.js"
        pin "three", version: "0.132.2", file: "build/three.js", provider: :unpkg
        pin "vue", version: "latest", file: "?bundle", provider: :esmsh
        pin "lodash-es", version: "4.17.21", provider: :skypack
        pin "stimulus", to: "@hotwired/stimulus", version: "3.0.0-beta.1", file: "dist/stimulus.js", provider: :jsdelivr

        pin_all_from "app/javascript/controllers", under: "controllers"
        pin_all_from "app/javascript/spina/controllers", under: "controllers/spina"
        pin_all_from "app/javascript/spina/controllers", under: "controllers/spina", to: "spina/controllers"
        pin_all_from "app/javascript/helpers", under: "helpers"
        pin_all_from "lib/assets/javascripts"
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

  test "remote pin off provider" do
    generate_importmap_json["imports"].tap do |imports|
      assert_equal "https://ga.jspm.io/npm:react@17.0.0/index.js", imports["react"]
      assert_equal "https://unpkg.com/three@0.132.2/build/three.js", imports["three"]
      assert_equal "https://esm.sh/vue@latest/?bundle", imports["vue"]
      assert_equal "https://cdn.jsdelivr.net/npm/@hotwired/stimulus@3.0.0-beta.1/dist/stimulus.js", imports["stimulus"]
    end
  end

  test "remote pin with missing provider" do
    @importmap = Importmap::Map.new.draw do
      pin "react", version: "17.0.0", file: "index.js"
    end
    
    assert_raises "Missing provider for 'react'" do
      generate_importmap_json
    end
  end

  test "remote pin with unknown provider" do
    @importmap = Importmap::Map.new.draw do
      pin "react", version: "17.0.0", file: "index.js", provider: :nowhere
    end
    
    assert_raises "Unknown provider 'nowhere' for 'react'" do
      generate_importmap_json
    end
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
