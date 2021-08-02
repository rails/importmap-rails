require "test_helper"

class ImportmapTest < ActiveSupport::TestCase
  test "files in app/javascripts show up in importmap" do
    json = JSON.parse Rails.application.config.importmap.paths.to_json(ActionController::Base.helpers)
    assert_match %r|assets/application-.*\.js|, json["imports"]["application"]
  end
end
