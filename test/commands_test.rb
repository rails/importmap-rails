require "test_helper"
require "json"

class CommandsTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::Isolation

  setup do
    @tmpdir = Dir.mktmpdir
    FileUtils.cp_r("#{__dir__}/dummy", @tmpdir)
    Dir.chdir("#{@tmpdir}/dummy")
    FileUtils.cp("#{__dir__}/../lib/install/bin/importmap", "bin")
  end

  teardown do
    FileUtils.remove_entry(@tmpdir) if @tmpdir
  end

  test "json command prints JSON with imports" do
    out, err = run_importmap_command("json")
    assert_includes JSON.parse(out), "imports"
  end

  test "update command prints message of no outdated packages" do
    out, _err = run_importmap_command("update")
    assert_includes out, "No outdated"
  end

  test "update command prints confirmation of pin with outdated packages" do
    @tmpdir = Dir.mktmpdir
    FileUtils.cp_r("#{__dir__}/dummy", @tmpdir)
    Dir.chdir("#{@tmpdir}/dummy")
    FileUtils.cp("#{__dir__}/fixtures/files/outdated_import_map.rb", "#{@tmpdir}/dummy/config/importmap.rb")
    FileUtils.cp("#{__dir__}/../lib/install/bin/importmap", "bin")

    out, _err = run_importmap_command("update")
    assert_includes out, "Pinning"
  end

  private
    def run_importmap_command(command, *args)
      capture_subprocess_io { system("bin/importmap", command, *args, exception: true) }
    end
end
