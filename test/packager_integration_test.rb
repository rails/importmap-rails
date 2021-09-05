require "test_helper"
require "importmap/packager"

class Importmap::PackagerIntegrationTest < ActiveSupport::TestCase
  setup { @packager = Importmap::Packager.new(Rails.root.join("config/importmap.rb")) }

  test "successful against live service" do
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
end
