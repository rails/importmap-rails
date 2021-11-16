require "test_helper"

class ImportmapsTest < ActiveSupport::TestCase
  def setup
    @importmaps = Importmap::Maps.new.tap do |maps|
      maps.draw do
        pin "application"

        map :public, entry_point: 'public' do
          pin "public", to: 'public/public.js'
          pin "md5", to: "https://cdn.skypack.dev/md5", preload: true

          pin_all_from "app/javascript/public/controllers", to: "public/controllers", under: "controllers", preload: true
          pin_all_from "app/javascript/helpers", under: "helpers", preload: true
        end
      end
    end
  end

  test "importmaps instance has a default map" do
    h = generate_importmap_json('default')
    assert_equal h['imports'].keys, [ 'application' ]
  end

  test "importmaps instance has an specific map" do
    h = generate_importmap_json('public')
    assert_equal h['imports'].keys, [ 'public', 'md5', 'controllers/hello_controller', 'controllers', 'helpers/requests' ]
  end

  private
    def generate_importmap_json(name)
      JSON.parse @importmaps[name].to_json(resolver: ApplicationController.helpers)
    end
end
