require "test_helper"
require "importmap/packager"
require "minitest/mock"

class Importmap::PackagerTest < ActiveSupport::TestCase
  setup { @packager = Importmap::Packager.new(Rails.root.join("config/importmap.rb")) }

  test "successful import with mock" do
    response = Class.new do
      def body
        {
          "staticDeps" => [
            "https://ga.jspm.io/npm:react@17.0.2/index.js",
            "https://ga.jspm.io/npm:object-assign@4.1.1/index.js"
          ],
          "dynamicDeps" => [],
          "map" => {
            "imports" => {
              "react" => "https://ga.jspm.io/npm:react@17.0.2/index.js",
              "object-assign" => "https://ga.jspm.io/npm:object-assign@4.1.1/index.js"
            }
          }
        }.to_json
      end

      def code() "200" end
    end.new

    Net::HTTP.stub(:post, response) do
      results = @packager.import("react@17.0.2")

      react_result = results.find { _1.package_name == "react" }
      object_assign_result = results.find { _1.package_name == "object-assign" }

      assert_equal("https://ga.jspm.io/npm:react@17.0.2/index.js", react_result.main_url)
      assert_equal("https://ga.jspm.io/npm:object-assign@4.1.1/index.js", object_assign_result.main_url)
    end
  end

  test "missing import with mock" do
    response = Class.new { def code() "404" end }.new

    Net::HTTP.stub(:post, response) do
      assert_nil @packager.import("missing-package-that-doesnt-exist@17.0.2")
    end
  end

  test "failed request with mock" do
    Net::HTTP.stub(:post, proc { raise "Unexpected Error" }) do
      assert_raises(Importmap::JspmApi::HTTPError) do
        @packager.import("missing-package-that-doesnt-exist@17.0.2")
      end
    end
  end

  test "packaged?" do
    assert @packager.packaged?("md5")
    assert_not @packager.packaged?("md5-extension")
  end
end
