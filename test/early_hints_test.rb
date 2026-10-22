require "test_helper"
require "importmap/early_hints"

class Importmap::EarlyHintsTest < ActionView::TestCase
  # Without this the case name resolves Importmap::EarlyHints as the helper
  # under test, and the tags helper's methods aren't in scope.
  tests Importmap::ImportmapTagsHelper

  attr_reader :request

  # The two preloaded pins of test/dummy/config/importmap.rb, in the order
  # javascript_importmap_module_preload_tags emits them.
  MD5_LINK       = "<https://cdn.skypack.dev/md5>; rel=modulepreload".freeze
  RICH_TEXT_LINK = "</rich_text.js>; rel=modulepreload".freeze

  class RecordingRequest
    attr_reader :hints

    def initialize
      @hints = []
    end

    def send_early_hints(links)
      @hints << links
    end

    def content_security_policy_nonce; end
  end

  class HintlessRequest
    def content_security_policy_nonce; end
  end

  class StreamingResponse
    def sending? = true
  end

  attr_accessor :response

  setup { @request = RecordingRequest.new }

  teardown { @request = nil }

  test "javascript_importmap_tags hints exactly the modules it preloads" do
    javascript_importmap_tags

    assert_equal 1, request.hints.size
    assert_equal "#{MD5_LINK}, #{RICH_TEXT_LINK}", request.hints.first["link"]
  end

  test "a hint carries no integrity, though the tag it mirrors does" do
    javascript_importmap_tags

    assert_no_match(/integrity/, request.hints.first["link"])
    assert_match(/integrity/, javascript_importmap_module_preload_tags)
  end

  test "the preload tags on their own hint nothing" do
    javascript_importmap_module_preload_tags

    assert_empty request.hints
  end

  test "an entry point that preloads nothing hints nothing" do
    importmap = Importmap::Map.new
    importmap.pin "foo", preload: false

    javascript_importmap_tags("foo", importmap: importmap)

    assert_empty request.hints
  end

  test "config.importmap.early_hints = false sends nothing" do
    Rails.application.config.importmap.early_hints = false

    javascript_importmap_tags

    assert_empty request.hints
  ensure
    Rails.application.config.importmap.early_hints = true
  end

  test "a response already streaming is left alone" do
    self.response = StreamingResponse.new

    javascript_importmap_tags

    assert_empty request.hints
  end

  test "a request that doesn't speak early hints is left alone" do
    @request = HintlessRequest.new

    assert_nothing_raised { javascript_importmap_tags }
  end

  test "no request at all is left alone" do
    @request = nil

    assert_nothing_raised { javascript_importmap_tags }
  end
end
