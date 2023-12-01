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

  private
    def run_importmap_command(command, *args)
      capture_subprocess_io { system("bin/importmap", command, *args, exception: true) }
    end
end
