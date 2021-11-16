require "test_helper"

# Stub method
def content_security_policy_nonce() nil end
def content_security_policy?() false end

class Importmap::ImportmapTagsHelperTest < ActionView::TestCase

  test "javascript_importmap_tags with default map" do
    assert_match \
      %r{<script type="module">import "application"</script>},
      javascript_importmap_tags
  end

  test "javascript_importmap_tags with specified map name" do
    assert_match \
      %r{<script type="module">import "public"</script>},
      javascript_importmap_tags(map: 'public', entry_point: 'public')
  end

  test "javascript_importmap_tags with and without shim" do
    assert_match /shim/, javascript_importmap_tags
    assert_no_match /shim/, javascript_importmap_tags(shim: false)
  end

  test "javascript_inline_importmap_tag" do
    assert_match \
      %r{<script type="importmap" data-turbo-track="reload">{\n  \"imports\": {\n    \"md5\": \"https://cdn.skypack.dev/md5\",\n    \"not_there\": \"/nowhere.js\"\n  }\n}</script>},
      javascript_inline_importmap_tag
      # map name: 'public' ...
    assert_match \
      %r{<script type="importmap" data-turbo-track="reload">{\n  \"imports\": {\n    \"md5\": \"https://cdn.skypack.dev/md5\",\n    \"public\": \"/public/public.js\",\n    \"controllers/hello_controller\": \"/public/controllers/hello_controller.js\",\n    \"controllers\": \"/public/controllers/index.js\"\n  }\n}</script>},
      javascript_inline_importmap_tag(Rails.application.importmaps['public'])
  end

  test "javascript_importmap_module_preload_tags" do
    assert_dom_equal \
      %(<link rel="modulepreload" href="https://cdn.skypack.dev/md5">),
      javascript_importmap_module_preload_tags
    assert_dom_equal \
      %(<link rel="modulepreload" href="https://cdn.skypack.dev/md5">),
      javascript_importmap_module_preload_tags(Rails.application.importmaps['public'])
  end
end
