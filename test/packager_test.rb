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
      assert_equal({}, result[:integrity])
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
      %(pin "react", to: "https://cdn/react", integrity: "sha384-abcdef"),
      @packager.pin_for("react", "https://cdn/react", integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", to: "https://cdn/react"),
      @packager.pin_for("react", "https://cdn/react", integrity: nil)
    )
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
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: true, integrity: "sha384-abcdef"),
      @packager.pin_for("react", "https://cdn/react", preloads: ["true"], integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: false, integrity: "sha384-abcdef"),
      @packager.pin_for("react", "https://cdn/react", preloads: ["false"], integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: "foo", integrity: "sha384-abcdef"),
      @packager.pin_for("react", "https://cdn/react", preloads: ["foo"], integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", to: "https://cdn/react", preload: ["foo", "bar"], integrity: "sha384-abcdef"),
      @packager.pin_for("react", "https://cdn/react", preloads: ["foo", "bar"], integrity: "sha384-abcdef")
    )

    assert_equal %(pin "react"), @packager.pin_for("react")
    assert_equal %(pin "react", preload: true), @packager.pin_for("react", preloads: ["true"])
    assert_equal %(pin "react", integrity: "sha384-abcdef"), @packager.pin_for("react", integrity: "sha384-abcdef")
    assert_equal %(pin "react", preload: true, integrity: "sha384-abcdef"), @packager.pin_for("react", preloads: ["true"], integrity: "sha384-abcdef")
  end

  test "vendored_pin_for" do
    assert_equal %(pin "react" # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2")
    assert_equal %(pin "javascript/react", to: "javascript--react.js" # @17.0.2), @packager.vendored_pin_for("javascript/react", "https://cdn/react@17.0.2")
    assert_equal %(pin "react", preload: true # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["true"])
    assert_equal %(pin "react", preload: false # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["false"])
    assert_equal %(pin "react", preload: "foo" # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["foo"])
    assert_equal %(pin "react", preload: ["foo", "bar"] # @17.0.2), @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["foo", "bar"])
    assert_equal(
      %(pin "react", integrity: "sha384-abcdef" # @17.0.2),
      @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", nil, integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "javascript/react", to: "javascript--react.js", integrity: "sha384-abcdef" # @17.0.2),
      @packager.vendored_pin_for("javascript/react", "https://cdn/react@17.0.2", nil, integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", preload: true, integrity: "sha384-abcdef" # @17.0.2),
      @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["true"], integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", preload: false, integrity: "sha384-abcdef" # @17.0.2),
      @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["false"], integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", preload: "foo", integrity: "sha384-abcdef" # @17.0.2),
      @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["foo"], integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react", preload: ["foo", "bar"], integrity: "sha384-abcdef" # @17.0.2),
      @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", ["foo", "bar"], integrity: "sha384-abcdef")
    )
    assert_equal(
      %(pin "react" # @17.0.2),
      @packager.vendored_pin_for("react", "https://cdn/react@17.0.2", nil, integrity: nil)
    )
  end

  test "import with integrity parameter" do
    response = Class.new do
      def body
        {
          "map" => {
            "imports" => imports,
            "integrity" => integrity_map
          }
        }.to_json
      end

      def imports
        {
          "react" => "https://ga.jspm.io/npm:react@17.0.2/index.js",
          "object-assign" => "https://ga.jspm.io/npm:object-assign@4.1.1/index.js"
        }
      end

      def integrity_map
        {
          "https://ga.jspm.io/npm:react@17.0.2/index.js" => "sha384-abcdef1234567890",
          "https://ga.jspm.io/npm:object-assign@4.1.1/index.js" => "sha384-1234567890abcdef"
        }
      end

      def code() "200" end
    end.new

    @packager.stub(:post_json, response) do
      result = @packager.import("react@17.0.2", integrity: true)
      assert_equal response.imports, result[:imports]
      assert_equal({
        "https://ga.jspm.io/npm:react@17.0.2/index.js" => "sha384-abcdef1234567890",
        "https://ga.jspm.io/npm:object-assign@4.1.1/index.js" => "sha384-1234567890abcdef"
      }, result[:integrity])
    end
  end
end
