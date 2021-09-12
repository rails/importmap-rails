module Importmap::ImportmapTagsHelper
  # Setup all script tags needed to use an importmap-powered entrypoint (which defaults to application.js)
  def javascript_importmap_tags(entry_point = "application")
    safe_join [
      javascript_inline_importmap_tag,
      javascript_importmap_module_preload_tags,
      javascript_importmap_shim_tag,
      javascript_import_module_tag(entry_point)
    ], "\n"
  end

  # Generate an inline importmap tag using the passed `importmap_json` JSON string.
  # By default, `Rails.application.config.importmap.to_json(resolver: self)` is used.
  def javascript_inline_importmap_tag(importmap_json = Rails.application.config.importmap.to_json(resolver: self))
    tag.script importmap_json.html_safe,
      type: "importmap", "data-turbo-track": "reload", nonce: content_security_policy_nonce
  end

  # Include the es-module-shim needed to make importmaps work in browsers without native support (like Firefox + Safari).
  def javascript_importmap_shim_tag
    javascript_include_tag "es-module-shims", async: true, "data-turbo-track": "reload"
  end

  # Import a named JavaScript module using a script-module tag.
  def javascript_import_module_tag(module_name)
    tag.script %(import "#{module_name}").html_safe, type: "module"
  end

  # Link tags for preloading all modules marked as preload: true in the `importmap`
  # (defaults to Rails.application.config.importmap), such that they'll be fetched
  # in advance by browsers supporting this link type (https://caniuse.com/?search=modulepreload).
  def javascript_importmap_module_preload_tags(importmap = Rails.application.config.importmap)
    javascript_module_preload_tag(*importmap.preloaded_module_paths(resolver: self))
  end

  # Link tag(s) for preloading the JavaScript module residing in `*paths`. Will return one link tag per path element.
  def javascript_module_preload_tag(*paths)
    safe_join(Array(paths).collect { |path| tag.link rel: "modulepreload", href: path }, "\n")
  end
end
