require "test_helper"
require "importmap/npm"
require "minitest/mock"

class Importmap::NpmTest < ActiveSupport::TestCase
  setup { @npm = Importmap::Npm.new(file_fixture("outdated_import_map.rb")) }

  test "successful outdated packages with mock" do
    response = { "dist-tags" => { "latest" => '2.3.0' } }.to_json

    @npm.stub(:get_json, response) do
      outdated_packages = @npm.outdated_packages

      assert_equal(1, outdated_packages.size)
      assert_equal('md5', outdated_packages[0].name)
      assert_equal('2.2.0', outdated_packages[0].current_version)
      assert_equal('2.3.0', outdated_packages[0].latest_version)
    end
  end

  test "successful outdated packages using single-quotes with mock" do
    npm = Importmap::Npm.new(file_fixture("single_quote_outdated_import_map.rb"))
    response = { "dist-tags" => { "latest" => '2.3.0' } }.to_json

    npm.stub(:get_json, response) do
      outdated_packages = npm.outdated_packages

      assert_equal(1, outdated_packages.size)
      assert_equal('md5', outdated_packages[0].name)
      assert_equal('2.2.0', outdated_packages[0].current_version)
      assert_equal('2.3.0', outdated_packages[0].latest_version)
    end
  end

  test "successful outdated packages using single-quotes and without CDN with mock" do
    npm = Importmap::Npm.new(file_fixture("single_quote_outdated_import_map_without_cdn.rb"))
    response = { "dist-tags" => { "latest" => '2.3.0' } }.to_json

    npm.stub(:get_json, response) do
      outdated_packages = npm.outdated_packages

      assert_equal(1, outdated_packages.size)
      assert_equal('md5', outdated_packages[0].name)
      assert_equal('2.2.0', outdated_packages[0].current_version)
      assert_equal('2.3.0', outdated_packages[0].latest_version)
    end
  end

  test "missing outdated packages with mock" do
    response = { "error" => "Not found" }.to_json

    @npm.stub(:get_json, response) do
      outdated_packages = @npm.outdated_packages

      assert_equal(1, outdated_packages.size)
      assert_equal('md5', outdated_packages[0].name)
      assert_equal('2.2.0', outdated_packages[0].current_version)
      assert_equal('Not found', outdated_packages[0].error)
    end
  end

  test "failed outdated packages request with mock" do
    Net::HTTP.stub(:start, proc { raise "Unexpected Error" }) do
      assert_raises(Importmap::Npm::HTTPError) do
        @npm.outdated_packages
      end
    end
  end

  test "successful vulnerable packages with mock" do
    response = Class.new do
      def body
        { "md5" => [{ "title" => "Unsafe hashing", "severity" => "high", "vulnerable_versions" => "<42.0.0" }] }.to_json
      end

      def code() "200" end
    end.new

    @npm.stub(:post_json, response) do
      vulnerable_packages = @npm.vulnerable_packages

      assert_equal(1, vulnerable_packages.size)
      assert_equal('md5', vulnerable_packages[0].name)
      assert_equal('Unsafe hashing', vulnerable_packages[0].vulnerability)
      assert_equal('high', vulnerable_packages[0].severity)
      assert_equal('<42.0.0', vulnerable_packages[0].vulnerable_versions)
    end
  end

  test "failed vulnerable packages request with mock" do
    Net::HTTP.stub(:post, proc { raise "Unexpected Error" }) do
      assert_raises(Importmap::Npm::HTTPError) do
        @npm.vulnerable_packages
      end
    end
  end
end
