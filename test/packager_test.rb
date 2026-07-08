require "test_helper"
require "importmap/packager"
require "minitest/mock"

class Importmap::PackagerTest < ActiveSupport::TestCase
  setup { @packager = Importmap::Packager.new(Rails.root.join("config/importmap.rb")) }

  test "successful import with mock" do
    response = Class.new do
      def body
        { "map" => { "imports" => imports } }.to_json
      end

      def imports
        {
          "react" => "https://ga.jspm.io/npm:react@17.0.2/index.js",
          "object-assign" => "https://ga.jspm.io/npm:object-assign@4.1.1/index.js"
        }
      end

      def code() "200" end
    end.new

    @packager.stub(:post_json, response) do
      result = @packager.import("react@17.0.2")
      assert_equal response.imports, result[:imports]
    end
  end

  test "missing import with mock" do
    response = Class.new { def code() "404" end }.new

    @packager.stub(:post_json, response) do
      assert_nil @packager.import("missing-package-that-doesnt-exist@17.0.2")
    end
  end

  test "failed request with mock" do
    Net::HTTP.stub(:post, proc { raise "Unexpected Error" }) do
      assert_raises(Importmap::Packager::HTTPError) do
        @packager.import("missing-package-that-doesnt-exist@17.0.2")
      end
    end
  end

  test "packaged?" do
    assert @packager.packaged?("md5")
    assert_not @packager.packaged?("md5-extension")
  end

  test "pin_for" do
    assert_equal %(pin "react", to: "https://cdn/react"), @packager.pin_for("react", "https://cdn/react")
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: true),
      @packager.pin_for("react", "https://cdn/react", preloads: ["true"])
    )
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: false),
      @packager.pin_for("react", "https://cdn/react", preloads: ["false"])
    )
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: "foo"),
      @packager.pin_for("react", "https://cdn/react", preloads: ["foo"])
    )
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: ["foo", "bar"]),
      @packager.pin_for("react", "https://cdn/react", preloads: ["foo", "bar"])
    )

    assert_equal %(pin "react"), @packager.pin_for("react")
    assert_equal %(pin "react", preload: true), @packager.pin_for("react", preloads: ["true"])
  end

  test "vendored_pin_for" do
    assert_equal %(pin "react" # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2")
    assert_equal %(pin "javascript/react", to: "javascript--react.js" # @17.0.2), @packager.vendored_pin_for("javascript/react", "https://cdn/react@17.0.2")
    assert_equal %(pin "react", preload: true # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["true"])
    assert_equal %(pin "react", preload: false # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["false"])
    assert_equal %(pin "react", preload: "foo" # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["foo"])
    assert_equal %(pin "react", preload: ["foo", "bar"] # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["foo", "bar"])
  end

  test "extract_existing_pin_options with preload false" do
    temp_importmap = create_temp_importmap('pin "package1", preload: false')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ preload: false }, options)
  end

  test "extract_existing_pin_options with preload true" do
    temp_importmap = create_temp_importmap('pin "package1", preload: true')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ preload: true }, options)
  end

  test "extract_existing_pin_options with custom preload string" do
    temp_importmap = create_temp_importmap('pin "package1", preload: "custom"')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ preload: "custom" }, options)
  end

  test "extract_existing_pin_options with custom preload array" do
    temp_importmap = create_temp_importmap('pin "package1", preload: ["custom1", "custom2"]')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ preload: ["custom1", "custom2"] }, options)
  end

  test "extract_existing_pin_options with to option only" do
    temp_importmap = create_temp_importmap('pin "package1", to: "custom_path.js"')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ to: "custom_path.js" }, options)
  end

  test "extract_existing_pin_options with integrity option only" do
    temp_importmap = create_temp_importmap('pin "package1", integrity: "sha384-abcdef1234567890"')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({}, options)
  end

  test "extract_existing_pin_options with multiple options" do
    temp_importmap = create_temp_importmap('pin "package1", to: "path.js", preload: false, integrity: "sha384-abcdef1234567890"')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ preload: false, to: "path.js" }, options)
  end

  test "extract_existing_pin_options with remote to option" do
    temp_importmap = create_temp_importmap('pin "package1", to: "https://ga.jspm.io/npm:package1@1.0.0/index.js", preload: false')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ preload: false, to: "https://ga.jspm.io/npm:package1@1.0.0/index.js" }, options)
  end

  test "extract_existing_pin_options with version comment" do
    temp_importmap = create_temp_importmap('pin "package1", preload: false # @2.0.0')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({ preload: false }, options)
  end

  test "extract_existing_pin_options with no options" do
    temp_importmap = create_temp_importmap('pin "package1"')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "package1")

    assert_equal({}, options)
  end

  test "extract_existing_pin_options with nonexistent package" do
    temp_importmap = create_temp_importmap('pin "package1", preload: false')
    packager = Importmap::Packager.new(temp_importmap)

    options = extract_options_for_package(packager, "nonexistent")

    assert_equal({}, options)
  end

  test "extract_existing_pin_options with nonexistent file" do
    packager = Importmap::Packager.new("/nonexistent/path")

    options = extract_options_for_package(packager, "package1")

    assert_nil options
  end

  test "extract_existing_pin_options handles multiple packages in one call" do
    temp_importmap = create_temp_importmap(<<~PINS)
      pin "package1", preload: false
      pin "package2", preload: true
      pin "package3", preload: "custom"
      pin "package4" # no options
    PINS

    packager = Importmap::Packager.new(temp_importmap)

    result = packager.extract_existing_pin_options(["package1", "package2", "package3", "package4", "nonexistent"])

    assert_equal({
      "package1" => { preload: false },
      "package2" => { preload: true },
      "package3" => { preload: "custom" },
      "package4" => {},
      "nonexistent" => {}
    }, result)
  end

  test "remote_pin?" do
    temp_importmap = create_temp_importmap(<<~PINS)
      pin "remote", to: "https://ga.jspm.io/npm:remote@1.0.0/index.js"
      pin 'single', to: 'https://cdn.jsdelivr.net/npm/single@1.0.0/index.js'
      pin "local", to: "local.js"
      pin "bare"
    PINS
    packager = Importmap::Packager.new(temp_importmap)

    assert packager.remote_pin?("remote")
    assert packager.remote_pin?("single")
    assert_not packager.remote_pin?("local")
    assert_not packager.remote_pin?("bare")
    assert_not packager.remote_pin?("missing")
  end

  test "provider_for_url" do
    assert_equal "jspm.io", @packager.provider_for_url("https://ga.jspm.io/npm:md5@2.3.0/md5.js")
    assert_equal "unpkg", @packager.provider_for_url("https://unpkg.com/md5@2.3.0/md5.js")
    assert_equal "jsdelivr", @packager.provider_for_url("https://cdn.jsdelivr.net/npm/md5@2.3.0/md5.js")
    assert_equal "skypack", @packager.provider_for_url("https://cdn.skypack.dev/md5@2.3.0")
    assert_equal "esm.sh", @packager.provider_for_url("https://esm.sh/*md5@2.3.0/md5.js")
    assert_nil @packager.provider_for_url("https://cdn.example.com/md5.js")
    assert_nil @packager.provider_for_url("not a url")
  end

  test "extract_package_version_from" do
    assert_equal "@17.0.2", @packager.extract_package_version_from("https://cdn/react@17.0.2")
    assert_equal "@2.0.0-beta.19", @packager.extract_package_version_from("https://ga.jspm.io/npm:@jspm/core@2.0.0-beta.19/nodelibs/browser/buffer.js")
    assert_nil @packager.extract_package_version_from("https://cdn/react")
  end

  private

  def create_temp_importmap(content)
    temp_file = Tempfile.new(['importmap', '.rb'])
    temp_file.write(content)
    temp_file.close
    temp_file.path
  end

  def extract_options_for_package(packager, package_name)
    result = packager.extract_existing_pin_options(package_name)
    result[package_name]
  end
end
