require "test_helper"
require "importmap/npm"

class Importmap::NpmIntegrationTest < ActiveSupport::TestCase
  test "successful outdated packages against live service" do
    file = file_fixture("outdated_import_map.rb")
    npm = Importmap::Npm.new(file)

    outdated_packages = npm.outdated_packages

    assert_equal(1, outdated_packages.size)
    assert_equal("md5", outdated_packages[0].name)
    assert_equal("2.2.0", outdated_packages[0].current_version)
    assert_match(/\d+\.\d+\.\d+/, outdated_packages[0].latest_version)
  end

  test "failed outdated packages request against live bad domain" do
    file = file_fixture("outdated_import_map.rb")
    npm = Importmap::Npm.new(file)

    original_base_uri = Importmap::Npm.base_uri
    Importmap::Npm.base_uri = URI("https://invalid.error")

    assert_raises(Importmap::Npm::HTTPError) do
      npm.outdated_packages
    end
  ensure
    Importmap::Npm.base_uri = original_base_uri
  end

  test "successful vulnerable packages against live service" do
    file = file_fixture("vulnerable_import_map.rb")
    npm = Importmap::Npm.new(file)

    vulnerable_packages = npm.vulnerable_packages

    assert(vulnerable_packages.size >= 2)

    assert_equal("is-svg", vulnerable_packages[0].name)
    assert_equal("is-svg", vulnerable_packages[1].name)

    severities = vulnerable_packages.map(&:severity)
    assert_includes(severities, "high")

    vulnerabilities = vulnerable_packages.map(&:vulnerability)
    assert_includes(vulnerabilities, "ReDOS in IS-SVG")
    assert_includes(vulnerabilities, "Regular Expression Denial of Service (ReDoS)")

    vulnerable_versions = vulnerable_packages.map(&:vulnerable_versions)
    assert_includes(vulnerable_versions, ">=2.1.0 <4.3.0")
    assert_includes(vulnerable_versions, ">=2.1.0 <4.2.2")
  end

  test "failed vulnerable packages request against live bad domain" do
    file = file_fixture("vulnerable_import_map.rb")
    npm = Importmap::Npm.new(file)

    original_base_uri = Importmap::Npm.base_uri
    Importmap::Npm.base_uri = URI("https://invalid.error")

    assert_raises(Importmap::Npm::HTTPError) do
      npm.vulnerable_packages
    end
  ensure
    Importmap::Npm.base_uri = original_base_uri
  end
end
