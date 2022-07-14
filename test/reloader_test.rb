require "test_helper"

class ReloaderTest < ActiveSupport::TestCase
  setup do
    @reloader = Importmap::Reloader.new
    @config   = Rails.root.join("config/importmap.rb")
  end

  test "reload is triggered when importmap changes" do
    assert_changes -> { @reloader.updated? }, from: false, to: true do
      touch_config
    end
  end

  test "redraws importmap when config changes" do
    Rails.application.importmap = Importmap::Map.new.draw { pin "md5", to: "https://cdn.skypack.dev/md5" }
    assert_not_predicate @reloader, :updated?

    assert_changes -> { Rails.application.importmap.packages.keys }, from: %w[ md5 ], to: %w[ md5 not_there ] do
      touch_config
      assert @reloader.execute_if_updated
    end
  end

  private
    def touch_config
      sleep 1
      FileUtils.touch(@config)
    end
end
