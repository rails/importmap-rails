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
end
