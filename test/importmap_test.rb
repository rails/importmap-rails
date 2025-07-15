require "test_helper"
require "minitest/mock"

class ImportmapTest < ActiveSupport::TestCase
  def setup
    @importmap = Importmap::Map.new.tap do |map|
      map.draw do
        pin "application", preload: false
        pin "editor", to: "rich_text.js", preload: false, integrity: "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb"
        pin "not_there", to: "nowhere.js", preload: false, integrity: "sha384-somefakehash"
        pin "md5", to: "https://cdn.skypack.dev/md5", preload: true
        pin "leaflet", to: "https://cdn.skypack.dev/leaflet", preload: 'application'
        pin "chartkick", to: "https://cdn.skypack.dev/chartkick", preload: ['application', 'alternate']
        pin "tinyMCE", to: "https://cdn.skypack.dev/tinymce", preload: 'alternate'

        pin_all_from "app/javascript/controllers", under: "controllers", preload: true
        pin_all_from "app/javascript/spina/controllers", under: "controllers/spina", preload: true
        pin_all_from "app/javascript/spina/controllers", under: "controllers/spina", to: "spina/controllers", preload: true
        pin_all_from "app/javascript/helpers", under: "helpers", preload: true
        pin_all_from "lib/assets/javascripts", preload: true
        pin_all_from "app/components", under: "controllers", to: "", preload: true
      end
    end
  end

  test "local pin with inferred to" do
    assert_match %r|assets/application-.*\.js|, generate_importmap_json["imports"]["application"]
  end

  test "local pin with explicit to" do
    assert_match %r|assets/rich_text-.*\.js|, generate_importmap_json["imports"]["editor"]
  end

  test "local pin with integrity" do
    editor_path = generate_importmap_json["imports"]["editor"]
    assert_match %r|assets/rich_text-.*\.js|, editor_path
    assert_equal "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb", generate_importmap_json["integrity"][editor_path]
    assert_nil generate_importmap_json["imports"]["not_there"]
    assert_not_includes generate_importmap_json["integrity"].values, "sha384-somefakehash"
  end

  test "integrity is not present if there is no integrity set in the map" do
    @importmap = Importmap::Map.new.tap do |map|
      map.pin "application", preload: false
    end

    assert_not generate_importmap_json.key?("integrity")
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

  test "directory pin mounted under matching subdir doesn't map *_index as root" do
    assert_match %r|assets/controllers/special_index.*\.js|, generate_importmap_json["imports"]["controllers/special_index"]
  end

  test "directory pin mounted under matching subdir maps index as root at second depth" do
    assert_match %r|assets/helpers/requests/index.*\.js|, generate_importmap_json["imports"]["helpers/requests"]
  end

  test "directory pin mounted under matching subdir doesn't map *_index as root at second depth" do
    assert_match %r|assets/helpers/requests/special_index.*\.js|, generate_importmap_json["imports"]["helpers/requests/special_index"]
  end

  test "directory pin under custom asset path" do
    assert_match %r|assets/spina/controllers/another_controller-.*\.js|, generate_importmap_json["imports"]["controllers/spina/another_controller"]
    assert_match %r|assets/spina/controllers/deeper/again_controller-.*\.js|, generate_importmap_json["imports"]["controllers/spina/deeper/again_controller"]
  end

  test "directory pin under custom asset path with empty to" do
    assert_match %r|assets/spina/component_controller-.*\.js|, generate_importmap_json["imports"]["controllers/spina/component_controller"]
    assert_match %r|assets/another_component_controller-.*\.js|, generate_importmap_json["imports"]["controllers/another_component_controller"]
  end

  test "directory pin without path or under" do
    assert_match %r|assets/my_lib-.*\.js|, generate_importmap_json["imports"]["my_lib"]
  end

  test "importmap json includes integrity hashes from integrity: true" do
    importmap = Importmap::Map.new.tap do |map|
      map.pin "application", integrity: true
    end

    json = JSON.parse(importmap.to_json(resolver: ApplicationController.helpers))

    assert json["integrity"], "Should include integrity section"

    application_path = json["imports"]["application"]
    assert application_path, "Should include application in imports"
    if ENV["ASSETS_PIPELINE"] == "sprockets"
      assert_equal "sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=", json["integrity"][application_path]
    else
      assert_equal "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb", json["integrity"][application_path]
    end
  end

  test "integrity: true with missing asset should be gracefully handled" do
    importmap = Importmap::Map.new.tap do |map|
      map.pin "missing", to: "nonexistent.js", preload: true, integrity: true
    end

    json = JSON.parse(importmap.to_json(resolver: ApplicationController.helpers))

    assert_empty json["imports"]
    assert_nil json["integrity"]
  end

  test "integrity: true with resolver that doesn't have asset_integrity method returns nil" do
    mock_resolver = Minitest::Mock.new

    mock_resolver.expect(:path_to_asset, "/assets/application-abc123.js", ["application.js"])
    mock_resolver.expect(:path_to_asset, "/assets/application-abc123.js", ["application.js"])

    importmap = Importmap::Map.new.tap do |map|
      map.pin "application", integrity: true
    end

    json = JSON.parse(importmap.to_json(resolver: mock_resolver))

    assert json["imports"]["application"]
    assert_match %r|/assets/application-.*\.js|, json["imports"]["application"]
    assert_nil json["integrity"]
  end

  test 'invalid importmap file results in error' do
    file = file_fixture('invalid_import_map.rb')
    importmap = Importmap::Map.new
    assert_raises Importmap::Map::InvalidFile do
      importmap.draw(file)
    end
  end

  test "preloaded modules are included in preload tags when no entry_point specified" do
    preloading_module_paths = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers).to_s
    assert_match(/md5/, preloading_module_paths)
    assert_match(/goodbye_controller/, preloading_module_paths)
    assert_match(/leaflet/, preloading_module_paths)
    assert_no_match(/application/, preloading_module_paths)
    assert_no_match(/tinymce/, preloading_module_paths)
  end

  test "preloaded modules are included in preload tags based on single entry_point provided" do
    preloading_module_paths = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers, entry_point: "alternate").to_s
    assert_no_match(/leaflet/, preloading_module_paths)
    assert_match(/tinymce/, preloading_module_paths)
    assert_match(/chartkick/, preloading_module_paths)
    assert_match(/md5/, preloading_module_paths)
    assert_match(/goodbye_controller/, preloading_module_paths)
    assert_no_match(/application/, preloading_module_paths)
  end

  test "preloaded modules are included in preload tags based on multiple entry_points provided" do
    preloading_module_paths = @importmap.preloaded_module_paths(resolver: ApplicationController.helpers, entry_point: ["application", "alternate"]).to_s
    assert_match(/leaflet/, preloading_module_paths)
    assert_match(/tinymce/, preloading_module_paths)
    assert_match(/chartkick/, preloading_module_paths)
    assert_match(/md5/, preloading_module_paths)
    assert_match(/goodbye_controller/, preloading_module_paths)
    assert_no_match(/application/, preloading_module_paths)
  end

  test "digest" do
    assert_match(/^\w{40}$/, @importmap.digest(resolver: ApplicationController.helpers))
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

  test "preloaded_module_packages returns hash of resolved paths to packages when no entry_point specified" do
    packages = @importmap.preloaded_module_packages(resolver: ApplicationController.helpers)

    md5 = packages["https://cdn.skypack.dev/md5"]
    assert md5, "Should include md5 package"
    assert_equal "md5", md5.name
    assert_equal "https://cdn.skypack.dev/md5", md5.path
    assert_equal true, md5.preload

    goodbye_controller_path = packages.keys.find { |path| path.include?("goodbye_controller") }
    assert goodbye_controller_path, "Should include goodbye_controller package"
    assert_equal "controllers/goodbye_controller", packages[goodbye_controller_path].name
    assert_equal true, packages[goodbye_controller_path].preload

    leaflet = packages["https://cdn.skypack.dev/leaflet"]
    assert leaflet, "Should include leaflet package"
    assert_equal "leaflet", leaflet.name
    assert_equal "https://cdn.skypack.dev/leaflet", leaflet.path
    assert_equal 'application', leaflet.preload

    chartkick = packages["https://cdn.skypack.dev/chartkick"]
    assert chartkick, "Should include chartkick package"
    assert_equal "chartkick", chartkick.name
    assert_equal ['application', 'alternate'], chartkick.preload

    application_path = packages.keys.find { |path| path.include?("application") }
    assert_nil application_path, "Should not include application package (preload: false)"

    tinymce_path = packages.keys.find { |path| path.include?("tinymce") }
    assert_nil tinymce_path, "Should not include tinymce package (preload: 'alternate')"
  end

  test "preloaded_module_packages returns hash based on single entry_point provided" do
    packages = @importmap.preloaded_module_packages(resolver: ApplicationController.helpers, entry_point: "alternate")

    tinymce = packages["https://cdn.skypack.dev/tinymce"]
    assert tinymce, "Should include tinymce package for alternate entry point"
    assert_equal "tinyMCE", tinymce.name
    assert_equal "https://cdn.skypack.dev/tinymce", tinymce.path
    assert_equal 'alternate', tinymce.preload

    # Should include packages for multiple entry points (chartkick preloads for both 'application' and 'alternate')
    chartkick = packages["https://cdn.skypack.dev/chartkick"]
    assert chartkick, "Should include chartkick package"
    assert_equal "chartkick", chartkick.name
    assert_equal ['application', 'alternate'], chartkick.preload

    # Should include always-preloaded packages
    md5 = packages["https://cdn.skypack.dev/md5"]
    assert md5, "Should include md5 package (always preloaded)"

    leaflet_path = packages.keys.find { |path| path.include?("leaflet") }
    assert_nil leaflet_path, "Should not include leaflet package (preload: 'application' only)"
  end

  test "preloaded_module_packages returns hash based on multiple entry_points provided" do
    packages = @importmap.preloaded_module_packages(resolver: ApplicationController.helpers, entry_point: ["application", "alternate"])

    leaflet = packages["https://cdn.skypack.dev/leaflet"]
    assert leaflet, "Should include leaflet package for application entry point"

    # Should include packages for 'alternate' entry point
    tinymce = packages["https://cdn.skypack.dev/tinymce"]
    assert tinymce, "Should include tinymce package for alternate entry point"

    # Should include packages for multiple entry points
    chartkick = packages["https://cdn.skypack.dev/chartkick"]
    assert chartkick, "Should include chartkick package for both entry points"

    # Should include always-preloaded packages
    md5 = packages["https://cdn.skypack.dev/md5"]
    assert md5, "Should include md5 package (always preloaded)"

    application_path = packages.keys.find { |path| path.include?("application") }
    assert_nil application_path, "Should not include application package (preload: false)"
  end

  test "preloaded_module_packages includes package integrity when present" do
    # Create a new importmap with a preloaded package that has integrity
    importmap = Importmap::Map.new.tap do |map|
      map.pin "editor", to: "rich_text.js", preload: true, integrity: "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb"
    end

    packages = importmap.preloaded_module_packages(resolver: ApplicationController.helpers)

    editor_path = packages.keys.find { |path| path.include?("rich_text") }
    assert editor_path, "Should include editor package"
    assert_equal "editor", packages[editor_path].name
    assert_equal "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb", packages[editor_path].integrity
  end

  test "pin with integrity: true should calculate integrity dynamically" do
    importmap = Importmap::Map.new.tap do |map|
      map.pin "editor", to: "rich_text.js", preload: true, integrity: "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb"
    end

    packages = importmap.preloaded_module_packages(resolver: ApplicationController.helpers)

    editor_path = packages.keys.find { |path| path.include?("rich_text") }
    assert editor_path, "Should include editor package"
    assert_equal "sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb", packages[editor_path].integrity
  end

  test "preloaded_module_packages uses custom cache_key" do
    set_one = @importmap.preloaded_module_packages(resolver: ApplicationController.helpers, cache_key: "1").to_s

    ActionController::Base.asset_host = "http://assets.example.com"

    set_two = @importmap.preloaded_module_packages(resolver: ActionController::Base.helpers, cache_key: "2").to_s

    assert_not_equal set_one, set_two
  ensure
    ActionController::Base.asset_host = nil
  end

  test "preloaded_module_packages caches reset" do
    set_one = @importmap.preloaded_module_packages(resolver: ApplicationController.helpers, cache_key: "1").to_s
    set_two = @importmap.preloaded_module_packages(resolver: ApplicationController.helpers, cache_key: "2").to_s

    @importmap.pin "something", to: "https://cdn.example.com/somewhere.js", preload: true

    assert_not_equal set_one, @importmap.preloaded_module_packages(resolver: ApplicationController.helpers, cache_key: "1").to_s
    assert_not_equal set_two, @importmap.preloaded_module_packages(resolver: ApplicationController.helpers, cache_key: "2").to_s
  end

  test "preloaded_module_packages handles missing assets gracefully" do
    importmap = Importmap::Map.new.tap do |map|
      map.pin "existing", to: "application.js", preload: true
      map.pin "missing", to: "nonexistent.js", preload: true
    end

    packages = importmap.preloaded_module_packages(resolver: ApplicationController.helpers)

    assert_equal 1, packages.size

    existing_path = packages.keys.find { |path| path&.include?("application") }
    assert existing_path, "Should include existing asset"
  end

  test "pin_all_from with integrity: true should calculate integrity dynamically" do
    importmap = Importmap::Map.new.tap do |map|
      map.pin_all_from "app/javascript/controllers", under: "controllers", integrity: true
    end

    packages = importmap.preloaded_module_packages(resolver: ApplicationController.helpers)

    controller_path = packages.keys.find { |path| path.include?("goodbye_controller") }
    assert controller_path, "Should include goodbye_controller package"
    if ENV["ASSETS_PIPELINE"] == "sprockets"
      assert_equal "sha256-6yWqFiaT8vQURc/OiKuIrEv9e/y4DMV/7nh7s5o3svA=", packages[controller_path].integrity
    else
      assert_equal "sha384-k7HGo2DomvN21em+AypqCekIFE3quejFnjQp3NtEIMyvFNpIdKThZhxr48anSNmP", packages[controller_path].integrity
    end
    assert_not_includes packages.map { |_, v| v.integrity }, nil
  end

  private
    def generate_importmap_json
      @generate_importmap_json ||= JSON.parse @importmap.to_json(resolver: ApplicationController.helpers)
    end
end
