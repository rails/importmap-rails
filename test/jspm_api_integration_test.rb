require "test_helper"
require "importmap/jspm_api"

class Importmap::JspmApiIntegrationTest < ActiveSupport::TestCase
  setup do
    @jspm_api = Importmap::JspmApi.new
  end

  test "#download when given a valid input" do
    result = @jspm_api.download(versioned_package_name: "@popperjs/core@2.11.8", provider: "jspm.io")

    assert result.keys.include?("lib/dom-utils/getWindow.js")
    assert result.keys.include?("lib/index.js")

    result = @jspm_api.download(versioned_package_name: "@popperjs/core@2.11.8", provider: "jspm")

    assert result.keys.include?("lib/dom-utils/getWindow.js")
    assert result.keys.include?("lib/index.js")
  end

  test "#download when given a bad package" do
    result = @jspm_api.download(versioned_package_name: "@popperjs/corenoversion", provider: "jspm.io")

    assert_equal result, {}
  end

  test "#download when given a bad provider" do
    result = @jspm_api.download(versioned_package_name: "@popperjs/corenoversion", provider: "jspmfoobarbaz")

    assert_equal result, {}
  end

  test "#download when endpoint is incorrect" do
    original_endpoint = Importmap::JspmApi.download_endpoint
    Importmap::JspmApi.download_endpoint = URI("https://invalid./error")

    assert_raises(Importmap::JspmApi::HTTPError) do
      @jspm_api.download(versioned_package_name: "@popperjs/core@2.11.8", provider: "jspm.io")
    end
  ensure
    Importmap::JspmApi.download_endpoint = original_endpoint
  end

  test "#generate when given valid input" do
    response = @jspm_api.generate(
      install: "tippy.js",
      flatten_scope: true,
      env: [ "browser", "module", nil ],
      provider: "jspm.io"
    )

    expected_imports = {
      "tippy.js" => "https://ga.jspm.io/npm:tippy.js@6.3.7/dist/tippy.esm.js",
      "@popperjs/core" => "https://ga.jspm.io/npm:@popperjs/core@2.11.8/lib/index.js"
    }

    assert_equal expected_imports, response.dig("map", "imports")
  end

  test "#generate when given non existent package" do
    response = @jspm_api.generate(
      install: "tippy.jsbutnotreallyalibrary",
      flatten_scope: true,
      env: nil,
      provider: "jspm.io"
    )

    assert_equal response, {}
  end

  test "#generate when endpoint is incorrect" do
    original_endpoint = Importmap::JspmApi.generate_endpoint
    Importmap::JspmApi.generate_endpoint = URI("https://invalid./error")

    assert_raises(Importmap::JspmApi::HTTPError) do
      @jspm_api.generate(
      install: "tippy.jsbutnotreallyalibrary",
      flatten_scope: true,
      env: nil,
      provider: "jspm.io"
    )
    end
  ensure
    Importmap::JspmApi.generate_endpoint = original_endpoint
  end
end
