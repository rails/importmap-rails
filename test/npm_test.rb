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

  test "extracts package name and version from nested package path" do
    npm = Importmap::Npm.new(file_fixture("nested_package_path_import_map.rb"))
    packages = npm.packages_with_versions

    assert_equal(1, packages.size)
    assert_equal('photoswipe', packages[0][0])
    assert_equal('5.4.4', packages[0][1])
  end

  test "extracts only base package name from nested package path with version comment" do
    npm = Importmap::Npm.new(file_fixture("nested_package_with_comment_import_map.rb"))
    packages = npm.packages_with_versions

    assert_equal(1, packages.size)
    assert_equal('photoswipe', packages[0][0])
    assert_equal('5.4.4', packages[0][1])
  end

  test "handles scoped package with nested path" do
    npm = Importmap::Npm.new(file_fixture("scoped_package_with_nested_path_import_map.rb"))
    packages = npm.packages_with_versions

    assert_equal(1, packages.size)
    assert_equal('@github/webauthn-json', packages[0][0])
    assert_equal('2.1.1', packages[0][1])
  end

  test "handles regular scoped package without nested path" do
    npm = Importmap::Npm.new(file_fixture("scoped_package_import_map.rb"))
    packages = npm.packages_with_versions

    assert_equal(1, packages.size)
    assert_equal('@github/webauthn-json', packages[0][0])
    assert_equal('2.1.1', packages[0][1])
  end

  test "successful outdated packages with nested package path using mock" do
    npm = Importmap::Npm.new(file_fixture("nested_package_path_import_map.rb"))
    response = { "dist-tags" => { "latest" => '5.5.0' } }.to_json

    npm.stub(:get_json, response) do
      outdated_packages = npm.outdated_packages

      assert_equal(1, outdated_packages.size)
      assert_equal('photoswipe', outdated_packages[0].name)
      assert_equal('5.4.4', outdated_packages[0].current_version)
      assert_equal('5.5.0', outdated_packages[0].latest_version)
    end
  end

  test "warns (and ignores) vendored packages without version" do
    Dir.mktmpdir do |vendor_path|
      foo_path = create_vendored_file(vendor_path, "foo.js")
      baz_path = create_vendored_file(vendor_path, "baz.js")

      npm = Importmap::Npm.new(file_fixture("import_map_without_cdn_and_versions.rb"), vendor_path: vendor_path)

      outdated_packages = []
      stdout, _stderr = capture_io { outdated_packages = npm.outdated_packages }

      assert_equal(<<~OUTPUT, stdout)
        Ignoring foo (#{foo_path}) since no version is specified in the importmap
        Ignoring @bar/baz (#{baz_path}) since no version is specified in the importmap
      OUTPUT
      assert_equal(0, outdated_packages.size)
    end
  end

  test "failed outdated packages request with error response" do
    client = Minitest::Mock.new
    response = Class.new do
      def body
        { "message" => "Service unavailable" }.to_json
      end

      def code() "500" end
    end.new

    client.expect(:request, nil, [Net::HTTP::Get])

    Net::HTTP.stub(:start, response, client) do
      e = assert_raises(Importmap::Npm::HTTPError) do
        @npm.outdated_packages
      end

      assert_equal "Unexpected error response 500: {\"message\":\"Service unavailable\"}", e.message
    end
  end

  test "failed vulnerable packages with mock" do
    response = Class.new do
      def body
        { "message" => "Service unavailable" }.to_json
      end

      def code() "500" end
    end.new

    @npm.stub(:post_json, response) do
      e = assert_raises(Importmap::Npm::HTTPError) do
        @npm.vulnerable_packages
      end
      assert_equal "Unexpected error response 500: {\"message\":\"Service unavailable\"}", e.message
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

  test "return latest version response is a String type" do
    response = "version not found".to_json

    @npm.stub(:get_json, response) do
      outdated_packages = @npm.outdated_packages

      assert_equal('version not found', outdated_packages[0].latest_version)
    end
  end

  def create_vendored_file(dir, name)
    path = File.join(dir, name)
    File.write(path, "console.log(123)")
    path
  end
end
