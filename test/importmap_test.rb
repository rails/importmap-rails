require "test_helper"

class ImportmapTest < ActiveSupport::TestCase
  test "files in app/javascripts show up in importmap" do
    assert_match %r|assets/application-.*\.js|, generate_importmap_json["imports"]["application"]
  end

  private
    def generate_importmap_json
      JSON.parse Rails.application.config.importmap.paths.to_json(ApplicationController.helpers)
    end
end
