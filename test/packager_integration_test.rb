require "test_helper"
require "importmap/packager"

class Importmap::PackagerIntegrationTest < ActiveSupport::TestCase
  setup { @packager = Importmap::Packager.new(Rails.root.join("config/importmap.rb")) }

  test "successful import against live service" do
    results = @packager.import("react@17.0.2")

    react_result = results.find { _1.package_name == "react" }
    object_assign_result = results.find { _1.package_name == "object-assign" }

    assert_equal("https://ga.jspm.io/npm:react@17.0.2/index.js", react_result.main_url)
    assert_equal("https://ga.jspm.io/npm:object-assign@4.1.1/index.js", object_assign_result.main_url)
  end

  test "missing import against live service" do
    assert_nil @packager.import("react-is-not-this-package@17.0.2")
  end

  test "failed request against live bad domain" do
    original_endpoint = Importmap::JspmApi.generate_endpoint
    Importmap::JspmApi.generate_endpoint = URI("https://invalid./error")

    assert_raises(Importmap::JspmApi::HTTPError) do
      @packager.import("missing-package-that-doesnt-exist@17.0.2")
    end
  ensure
    Importmap::JspmApi.generate_endpoint = original_endpoint
  end

  test "successful downloads from live service" do
    Dir.mktmpdir do |vendor_dir|
      importmap_path = Pathname.new(vendor_dir).join("importmap.rb")

      File.new(importmap_path, "w").close

      @packager = Importmap::Packager.new(
        importmap_path,
        vendor_path: Pathname.new(vendor_dir),
      )

      packages  = @packager.import("react@17.0.2")
      packages.each(&:download)

      vendored_file = Pathname.new(vendor_dir).join("react/cjs/react.production.min.js")
      assert_equal "// react@17.0.2/cjs/react.production.min.js downloaded from https://ga.jspm.io/npm:react@17.0.2/cjs/react.production.min.js",
        File.readlines(vendored_file).first.strip
      vendored_file = Pathname.new(vendor_dir).join("react/index.js")
      assert_equal "// react@17.0.2/index.js downloaded from https://ga.jspm.io/npm:react@17.0.2/index.js",
        File.readlines(vendored_file).first.strip
      vendored_file = Pathname.new(vendor_dir).join("object-assign/index.js")
      assert_equal "// object-assign@4.1.1/index.js downloaded from https://ga.jspm.io/npm:object-assign@4.1.1/index.js",
        File.readlines(vendored_file).first.strip

      packages.each(&:remove)

      assert_not File.exist?(Pathname.new(vendor_dir).join("react/cjs/react.production.min.js"))
      assert_not File.exist?(Pathname.new(vendor_dir).join("react/index.js"))
      assert_not File.exist?(Pathname.new(vendor_dir).join("object-assign/index.js"))

      packages  = @packager.import("@github/webauthn-json@0.5.7")
      packages.each(&:download)

      vendored_file = Pathname.new(vendor_dir).join("@github--webauthn-json/dist/main/webauthn-json.js")
      assert_equal "// @github/webauthn-json@0.5.7/dist/main/webauthn-json.js downloaded from https://ga.jspm.io/npm:@github/webauthn-json@0.5.7/dist/main/webauthn-json.js",
        File.readlines(vendored_file).first.strip

      packages.each(&:remove)

      assert_not File.exist?(Pathname.new(vendor_dir).join("webauthn-json/dist/main/webauthn-json.js"))
    end
  end

  test "successful importmap.rb updates from live service" do
    Dir.mktmpdir do |vendor_dir|
      importmap_path = Pathname.new(vendor_dir).join("importmap.rb")

      File.new(importmap_path, "w").close

      @packager = Importmap::Packager.new(
        importmap_path,
        vendor_path: Pathname.new(vendor_dir),
      )

      packages  = @packager.import("react@17.0.2")
      packages.each(&:download)

      importmap = <<~RB
        pin "react", to: "react/index.js" # @17.0.2
        pin "object-assign", to: "object-assign/index.js" # @4.1.1
      RB

      assert_equal importmap, importmap_path.read

      packages.each(&:remove)

      assert_equal "", importmap_path.read
    end
  end
end
