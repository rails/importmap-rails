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

  test "update command preserves preload false option" do
    importmap_config('pin "md5", to: "https://cdn.skypack.dev/md5@2.2.0", preload: false')

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes updated_content, "preload: false"
    assert_includes updated_content, "# @2.3.0"
  end

  test "update command preserves preload true option" do
    importmap_config('pin "md5", to: "https://cdn.skypack.dev/md5@2.2.0", preload: true')

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes updated_content, "preload: true"
  end

  test "update command preserves custom preload string option" do
    importmap_config('pin "md5", to: "https://cdn.skypack.dev/md5@2.2.0", preload: "custom"')

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes updated_content, 'preload: "custom"'
  end

  test "update command removes existing integrity" do
    importmap_config('pin "md5", to: "https://cdn.skypack.dev/md5@2.2.0", integrity: "sha384-oldintegrity"')

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_not_includes updated_content, "integrity:"
  end

  test "update command only keeps preload option" do
    importmap_config('pin "md5", to: "https://cdn.skypack.dev/md5@2.2.0", preload: false, integrity: "sha384-oldintegrity"')

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes updated_content, "preload: false"
    assert_not_includes updated_content, "to:"
    assert_not_includes updated_content, "integrity:"
  end

  test "update command handles packages with different quote styles" do
    importmap_config("pin 'md5', to: 'https://cdn.skypack.dev/md5@2.2.0', preload: false")

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes updated_content, "preload: false"
  end

  test "update command preserves options with version comments" do
    importmap_config('pin "md5", to: "https://cdn.skypack.dev/md5@2.2.0", preload: false # @2.2.0')

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_includes updated_content, "preload: false"
    assert_includes updated_content, "# @2.3.0"
    assert_not_includes updated_content, "# @2.2.0"
  end

  test "update command handles whitespace variations in pin options" do
    importmap_config('pin "md5",   to:  "https://cdn.skypack.dev/md5@2.2.0",  preload:  false   ')

    out, _err = run_importmap_command("update")

    assert_includes out, "Pinning"

    updated_content = File.read("#{@tmpdir}/dummy/config/importmap.rb")
    assert_equal 4, updated_content.lines.size
    assert_includes updated_content, "preload: false"
  end

  private
    def importmap_config(content)
      File.write("#{@tmpdir}/dummy/config/importmap.rb", content)
    end

    def run_importmap_command(command, *args)
      capture_subprocess_io { system("bin/importmap", command, *args, exception: true) }
    end
end
