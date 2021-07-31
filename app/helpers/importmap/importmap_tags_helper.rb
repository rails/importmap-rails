module Importmap::ImportmapTagsHelper
  def javascript_importmap_tags(entry_point = "application")
    safe_join [
      javascript_inline_importmap_tag,
      javascript_importmap_shim_tag,
      javascript_import_module_tag(entry_point)
    ], "\n"
  end

  def javascript_inline_importmap_tag(importmap_paths = Rails.application.config.importmap.paths)
    tag.script(importmap_paths.to_json(self).html_safe, type: "importmap")
  end

  def javascript_importmap_shim_tag
    javascript_include_tag "es-module-shims", async: true
  end

  def javascript_import_module_tag(module_name)
    tag.script %(import "#{module_name}").html_safe, type: "module"
  end
end
