require "test_helper"
require "json"

class CommandsTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::Isolation

  setup do
    @tmpdir = Dir.mktmpdir
    FileUtils.cp_r("#{__dir__}/dummy", @tmpdir)
    Dir.chdir("#{@tmpdir}/dummy")
  end

  teardown do
    FileUtils.remove_entry(@tmpdir) if @tmpdir
  end

  test "json command prints JSON with imports" do
    out, _err = run_importmap_command("json")

    assert_includes JSON.parse(out), "imports"
  end

  test "update command prints message of no outdated packages" do
    out, _err = run_importmap_command("update")

    assert_includes out, "No outdated"
  end

  test "update command prints confirmation of pin with outdated packages" do
    FileUtils.cp("#{__dir__}/fixtures/files/outdated_import_map.rb", "#{@tmpdir}/dummy/config/importmap.rb")

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"
  end

  test "pristine command redownloads all pinned packages" do
    FileUtils.cp("#{__dir__}/fixtures/files/outdated_import_map.rb", "#{@tmpdir}/dummy/config/importmap.rb")

    out, _err = run_importmap_command("pin", "md5@2.2.0")

    assert_includes out, 'Pinning "md5" to vendor/javascript/md5.js via download from https://ga.jspm.io/npm:md5@2.2.0/md5.js'

    original = File.read("#{@tmpdir}/dummy/vendor/javascript/md5.js")
    File.write("#{@tmpdir}/dummy/vendor/javascript/md5.js", "corrupted")

    out, _err = run_importmap_command("pristine")

    assert_includes out, 'Downloading "md5" to vendor/javascript/md5.js from https://ga.jspm.io/npm:md5@2.2.0'
    assert_equal original, File.read("#{@tmpdir}/dummy/vendor/javascript/md5.js")
  end

  test "pin command includes integrity by default" do
    out, _err = run_importmap_command("pin", "md5@2.2.0")

    assert_includes out, 'Pinning "md5" to vendor/javascript/md5.js via download from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_includes out, 'Using integrity:'

    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'pin "md5", integrity: "sha384-'
  end

  test "pin command with --no-integrity option excludes integrity" do
    out, _err = run_importmap_command("pin", "md5@2.2.0", "--no-integrity")

    assert_includes out, 'Pinning "md5" to vendor/javascript/md5.js via download from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_not_includes out, 'Using integrity:'

    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'pin "md5" # @2.2.0'
  end

  test "pristine command includes integrity by default" do
    FileUtils.cp("#{__dir__}/fixtures/files/outdated_import_map.rb", "#{@tmpdir}/dummy/config/importmap.rb")

    out, _err = run_importmap_command("pristine")

    assert_includes out, 'Downloading "md5" to vendor/javascript/md5.js from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_includes out, 'Using integrity:'
  end

  test "pristine command with --no-integrity option excludes integrity" do
    FileUtils.cp("#{__dir__}/fixtures/files/outdated_import_map.rb", "#{@tmpdir}/dummy/config/importmap.rb")

    out, _err = run_importmap_command("pristine", "--no-integrity")

    assert_includes out, 'Downloading "md5" to vendor/javascript/md5.js from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_not_includes out, 'Using integrity:'
  end

  test "pin command with explicit --integrity option includes integrity" do
    out, _err = run_importmap_command("pin", "md5@2.2.0", "--integrity")

    assert_includes out, 'Pinning "md5" to vendor/javascript/md5.js via download from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_includes out, 'Using integrity:'

    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'integrity: "sha384-'
  end

  test "pin command with multiple packages includes integrity for all" do
    out, _err = run_importmap_command("pin", "md5@2.2.0", "lodash@4.17.21")

    assert_includes out, 'Pinning "md5"'
    assert_includes out, 'Pinning "lodash"'
    assert_includes out, 'Using integrity:'

    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'pin "md5"'
    assert_includes config_content, 'pin "lodash"'

    md5_lines = config_content.lines.select { |line| line.include?('pin "md5"') }
    lodash_lines = config_content.lines.select { |line| line.include?('pin "lodash"') }
    assert md5_lines.any? { |line| line.include?('integrity:') }
    assert lodash_lines.any? { |line| line.include?('integrity:') }
  end

  test "pin command with preload option includes integrity and preload" do
    out, _err = run_importmap_command("pin", "md5@2.2.0", "--preload", "true")

    assert_includes out, 'Pinning "md5" to vendor/javascript/md5.js via download from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_includes out, 'Using integrity:'

    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'preload: true'
    assert_includes config_content, 'integrity: "sha384-'
  end

  test "integrity command shows integrity hashes for specific packages" do
    out, _err = run_importmap_command("integrity", "md5@2.2.0")

    assert_includes out, 'Getting integrity for "md5" from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_includes out, 'md5: sha384-'
  end

  test "integrity command with --update option updates importmap.rb" do
    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'pin "md5", to: "https://cdn.skypack.dev/md5", preload: true'

    out, _err = run_importmap_command("integrity", "md5@2.2.0", "--update")

    assert_includes out, 'Getting integrity for "md5" from https://ga.jspm.io/npm:md5@2.2.0/md5.js'
    assert_includes out, 'md5: sha384-'
    assert_includes out, 'Updated importmap.rb with integrity for "md5"'

    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'pin "md5", to: "https://ga.jspm.io/npm:md5@2.2.0/md5.js", integrity: "sha384-'
  end

  test "integrity command with multiple packages shows integrity for all" do
    out, _err = run_importmap_command("integrity", "md5@2.2.0", "lodash@4.17.21")

    assert_includes out, 'Getting integrity for "md5"'
    assert_includes out, 'Getting integrity for "lodash"'
    assert_includes out, 'md5: sha384-'
    assert_includes out, 'lodash: sha384-'
  end

  test "integrity command without packages shows integrity for all remote packages" do
    run_importmap_command("pin", "md5@2.2.0", "--no-integrity")

    out, _err = run_importmap_command("integrity")

    assert_includes out, 'Getting integrity for "md5"'
    assert_includes out, 'md5: sha384-'
  end

  test "integrity command with --update updates multiple packages" do
    run_importmap_command("pin", "md5@2.2.0", "--no-integrity")
    run_importmap_command("pin", "lodash@4.17.21", "--no-integrity")

    out, _err = run_importmap_command("integrity", "--update")

    assert_includes out, 'Updated importmap.rb with integrity for "md5"'
    assert_includes out, 'Updated importmap.rb with integrity for "lodash"'

    config_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes config_content, 'pin "md5", to: "https://ga.jspm.io/npm:md5@2.2.0/md5.js", integrity: "sha384-'
    assert_includes config_content, 'pin "lodash", to: "https://ga.jspm.io/npm:lodash@4.17.21/lodash.js", integrity: "sha384-'
  end

  test "integrity command with env option" do
    out, _err = run_importmap_command("integrity", "md5@2.2.0", "--env", "development")

    assert_includes out, 'Getting integrity for "md5"'
    assert_includes out, 'md5: sha384-'
  end

  test "integrity command with from option" do
    out, _err = run_importmap_command("integrity", "md5@2.2.0", "--from", "jspm")

    assert_includes out, 'Getting integrity for "md5"'
    assert_includes out, 'md5: sha384-'
  end

  private
    def run_importmap_command(command, *args)
      capture_subprocess_io { system("bin/importmap", command, *args, exception: true) }
    end
end
