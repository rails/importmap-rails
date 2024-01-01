module Importmap::ImportmapTagsHelper
  # Setup all script tags needed to use an importmap-powered entrypoint (which defaults to application.js)
  def javascript_importmap_tags(entry_point = "application", importmap: Rails.application.importmap)
    safe_join [
      javascript_inline_importmap_tag(importmap.to_json(resolver: self)),
      javascript_importmap_module_preload_tags(importmap),
      javascript_import_module_tag(entry_point)
    ], "\n"
  end

  # Generate an inline importmap tag using the passed `importmap_json` JSON string.
  # By default, `Rails.application.importmap.to_json(resolver: self)` is used.
  def javascript_inline_importmap_tag(importmap_json = Rails.application.importmap.to_json(resolver: self))
    tag.script importmap_json.html_safe,
      type: "importmap", "data-turbo-track": "reload", nonce: request&.content_security_policy_nonce
  end

  # Import a named JavaScript module(s) using a script-module tag.
  def javascript_import_module_tag(*module_names)
    imports = Array(module_names).collect { |m| %(import "#{m}") }.join("\n")
    tag.script imports.html_safe, type: "module", nonce: request&.content_security_policy_nonce
  end

  # Link tags for preloading all modules marked as preload: true in the `importmap`
  # (defaults to Rails.application.importmap), such that they'll be fetched
  # in advance by browsers supporting this link type (https://caniuse.com/?search=modulepreload).
  def javascript_importmap_module_preload_tags(importmap = Rails.application.importmap)
    javascript_module_preload_tag(*importmap.preloaded_module_paths(resolver: self))
  end

  # Link tag(s) for preloading the JavaScript module residing in `*paths`. Will return one link tag per path element.
  def javascript_module_preload_tag(*paths)
    safe_join(Array(paths).collect { |path|
      tag.link rel: "modulepreload", href: path, nonce: request&.content_security_policy_nonce
    }, "\n")
  end
end
