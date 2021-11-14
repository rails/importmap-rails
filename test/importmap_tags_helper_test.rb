require "test_helper"

# Stub method
def content_security_policy_nonce() nil end
def content_security_policy?() false end

class Importmap::ImportmapTagsHelperTest < ActionView::TestCase
  test "javascript_importmap_tags with and without shim" do
    assert_match /shim/, javascript_importmap_tags("application")
    assert_no_match /shim/, javascript_importmap_tags("application", shim: false)
  end

  test "javascript_inline_importmap_tag" do
    assert_match \
      %r{<script type="importmap" data-turbo-track="reload">{\n  \"imports\": {\n    \"md5\": \"https://cdn.skypack.dev/md5\",\n    \"not_there\": \"/nowhere.js\"\n  }\n}</script>},
      javascript_inline_importmap_tag
  end

  test "javascript_importmap_module_preload_tags" do
    assert_dom_equal \
      %(<link rel="modulepreload" href="https://cdn.skypack.dev/md5">),
      javascript_importmap_module_preload_tags
  end

  test "javascript_importmap_tags with explicit importmap" do
    map_path = File.expand_path( File.join(__dir__,'./dummy/config/importmap.alternate.rb'))
    assert File.exists?(map_path) # avoid silent failure on #draw
    importmap_tags = javascript_importmap_tags("alternate_app", importmap: Importmap::Map.new.draw(map_path))

    assert_match \
      %r{<script type="module">import "alternate_app"</script>},
      importmap_tags

    assert_match \
      %r{"application": "/alternate/alternate_app.js"},
      importmap_tags

    assert_match \
      %{"controllers/hello_controller": "/alternate/controllers/hello_controller.js"},
      importmap_tags
  end
end
