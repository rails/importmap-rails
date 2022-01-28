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
      assert_equal(response.imports, @packager.import("react@17.0.2"))
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
  end

  test "vendored_pin_for" do
    assert_equal %(pin "react" # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2")
    assert_equal %(pin "javascript/react", to: "javascript--react.js" # @17.0.2), @packager.vendored_pin_for("javascript/react", "https://cdn/react@17.0.2")
  end
end
