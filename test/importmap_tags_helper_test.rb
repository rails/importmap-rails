require "test_helper"

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
end
