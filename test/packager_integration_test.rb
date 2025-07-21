require "test_helper"
require "importmap/packager"

class Importmap::PackagerIntegrationTest < ActiveSupport::TestCase
  setup { @packager = Importmap::Packager.new(Rails.root.join("config/importmap.rb")) }

  test "successful import against live service" do
    assert_equal "https://ga.jspm.io/npm:react@17.0.2/index.js", @packager.import("react@17.0.2")["react"]
  end

  test "missing import against live service" do
    assert_nil @packager.import("react-is-not-this-package@17.0.2")
  end

  test "failed request against live bad domain" do
    original_endpoint = Importmap::Packager.endpoint
    Importmap::Packager.endpoint = URI("https://invalid./error")

    assert_raises(Importmap::Packager::HTTPError) do
      @packager.import("missing-package-that-doesnt-exist@17.0.2")
    end
  ensure
    Importmap::Packager.endpoint = original_endpoint
  end

  test "successful downloads from live service" do
    Dir.mktmpdir do |vendor_dir|
      @packager = Importmap::Packager.new \
        Rails.root.join("config/importmap.rb"),
        vendor_path: Pathname.new(vendor_dir)

      package_url = "https://ga.jspm.io/npm:@github/webauthn-json@0.5.7/dist/main/webauthn-json.js"
      @packager.download("@github/webauthn-json", package_url)
      vendored_package_file = Pathname.new(vendor_dir).join("@github--webauthn-json.js")
      assert File.exist?(vendored_package_file)
      assert_equal "// @github/webauthn-json@0.5.7 downloaded from #{package_url}", File.readlines(vendored_package_file).first.strip
      assert @packager.verify("@github/webauthn-json", package_url)

      package_url = "https://ga.jspm.io/npm:react@17.0.2/index.js"
      vendored_package_file = Pathname.new(vendor_dir).join("react.js")
      @packager.download("react", package_url)
      assert File.exist?(vendored_package_file)
      assert_equal "// react@17.0.2 downloaded from #{package_url}", File.readlines(vendored_package_file).first.strip
      assert @packager.verify("react", package_url)

      File.write(vendored_package_file, "// altered content")

      assert_raises(Importmap::Packager::VerifyError) do
        @packager.verify("react", package_url)
      end

      @packager.remove("react")
      assert_not File.exist?(Pathname.new(vendor_dir).join("react.js"))

      refute @packager.verify("react", package_url)
    end
  end
end
