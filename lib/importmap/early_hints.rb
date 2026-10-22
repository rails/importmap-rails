# Sends the modulepreload links of javascript_importmap_tags as 103 Early Hints,
# so the browser can start fetching the module graph while the app is still
# rendering — as javascript_include_tag and stylesheet_link_tag already do for
# their assets.
#
# `request.send_early_hints` is a no-op unless the server supports it (Puma with
# `early_hints true`), so on any other server this costs nothing.
module Importmap::EarlyHints # :nodoc:
  class << self
    def send_modulepreload_links(view, packages)
      return if packages.empty? || !enabled? || sending?(view)

      request = view.request if view.respond_to?(:request)
      return unless request.respond_to?(:send_early_hints)

      request.send_early_hints("link" => link_header_for(packages.keys))
    end

    private
      # No integrity parameter: browsers don't honour one on a Link header, and
      # the modulepreload tag in the body still carries it.
      def link_header_for(paths)
        paths.collect { |path| "<#{path}>; rel=modulepreload" }.join(", ")
      end

      # Under `render stream: true` the response is already being written when
      # the layout renders, and a 103 sent then would land inside the body.
      def sending?(view)
        return false unless view.respond_to?(:response)

        (response = view.response).respond_to?(:sending?) && response.sending?
      end

      def enabled?
        Rails.application.config.importmap.early_hints
      end
  end
end
