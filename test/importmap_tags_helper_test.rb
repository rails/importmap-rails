require "test_helper"

class Importmap::ImportmapTagsHelperTest < ActionView::TestCase
  test "javascript_inline_importmap_tag" do
    assert_dom_equal \
      %(<script type="importmap" data-turbo-track="reload">{"imports":{"md5":"https://cdn.skypack.dev/md5","not_there":"/nowhere.js","application":"/application.js","controllers/goodbye_controller":"/controllers/goodbye_controller.js"}}</script>),
      javascript_inline_importmap_tag
  end

  test "javascript_importmap_module_preload_tags" do
    assert_dom_equal \
      %(<link rel="modulepreload" href="https://cdn.skypack.dev/md5">),
      javascript_importmap_module_preload_tags
  end
end
