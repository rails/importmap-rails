require "test_helper"

if defined?(Ractor)
  class ImportmapRactorTest < ActiveSupport::TestCase
    test "generates JSON in a non-main Ractor" do
      map = Ractor.make_shareable(Importmap::Map.new)
      ractor = Ractor.new(map) do |map|
        map.to_json(resolver: nil)
      end
      json = ractor.respond_to?(:value) ? ractor.value : ractor.take

      assert_equal({ "imports" => {} }, JSON.parse(json))
    end
  end
end
