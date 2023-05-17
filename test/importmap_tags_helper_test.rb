require "test_helper"

class Importmap::ImportmapTagsHelperTest < ActionView::TestCase
  attr_reader :request

  class FakeRequest
    def initialize(nonce = nil)
      @nonce = nonce
    end

    def send_early_hints(links); end

    def content_security_policy
      Object.new if @nonce
    end

    def content_security_policy_nonce
      @nonce
    end
  end

  test "javascript_importmap_tags with and without shim" do
    assert_match /es-module-shims/, javascript_importmap_tags("application")
    assert_no_match /es-module-shims/, javascript_importmap_tags("application", shim: false)
  end

  test "javascript_inline_importmap_tag" do
    assert_match \
      %r{<script type="importmap-shim" data-turbo-track="reload">{\n  \"imports\": {\n    \"md5\": \"https://cdn.skypack.dev/md5\",\n    \"not_there\": \"/nowhere.js\",\n    \"application\": \"/application.js\"\n  }\n}</script>},
      javascript_inline_importmap_tag
  end

  test "javascript_importmap_module_preload_tags" do
    assert_dom_equal \
      %(<link rel="modulepreload" href="https://cdn.skypack.dev/md5">),
      javascript_importmap_module_preload_tags
  end

  test "tags have no nonce if CSP is not configured" do
    @request = FakeRequest.new

    assert_no_match /nonce/, javascript_importmap_tags("application")
  ensure
    @request = nil
  end

  test "tags have nonce if CSP is configured" do
    @request = FakeRequest.new("iyhD0Yc0W+c=")

    assert_match /nonce="iyhD0Yc0W\+c="/, javascript_inline_importmap_tag
    assert_match /nonce="iyhD0Yc0W\+c="/, javascript_importmap_shim_configuration_tag
    assert_match /nonce="iyhD0Yc0W\+c="/, javascript_importmap_shim_tag
    assert_match /nonce="iyhD0Yc0W\+c="/, javascript_import_module_tag("application")
    assert_match /nonce="iyhD0Yc0W\+c="/, javascript_importmap_module_preload_tags
  ensure
    @request = nil
  end

  test "using a custom importmap" do
    importmap = Importmap::Map.new
    importmap.pin "foo", preload: true
    importmap.pin "bar", preload: false
    importmap_html = javascript_importmap_tags("foo", importmap: importmap)

    assert_includes importmap_html, %{<script type="importmap-shim" data-turbo-track="reload">}
    assert_includes importmap_html, %{"foo": "/foo.js"}
    assert_includes importmap_html, %{"bar": "/bar.js"}
    assert_includes importmap_html, %{<link rel="modulepreload" href="/foo.js">}
    refute_includes importmap_html, %{<link rel="modulepreload" href="/bar.js">}
    assert_includes importmap_html, %{<script type="module-shim">import "foo"</script>}
  end

  test "integrity shas are specified and integrity shim option is enabled if any pin has integrity" do
    assert_dom_equal \
      <<~HTML.chomp,
        <link rel="modulepreload-shim" href="https://cdn.skypack.dev/md5" integrity="sha384-Z4mBXx9MNus/5gJoxoUytBtq6JEV77AuAnUdPedFRPuIB+puUQ2EE6LsC8bY9CBR">
        <link rel="modulepreload-shim" href="/application.js" integrity="sha256-rtJxuS0yqe/8JI4gvbQHf7+EKTGA/a8Uk+J1wyIEBrE=">
      HTML
      javascript_importmap_integrity_tags
    assert_dom_equal \
      %(<script type="esms-options">{"enforceIntegrity":true}</script>),
      javascript_importmap_shim_configuration_tag
  end
end
