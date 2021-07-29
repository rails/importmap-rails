module Importmap::ImportmapTagsHelper
  def importmap_include_tags(importmap = "importmap.json")
    safe_join [
      javascript_include_tag("es-module-shims", async: true),
      tag.script(src: asset_path(importmap), type: "importmap-shim")
    ], "\n"
  end

  def javascript_module_tag(*sources)
    javascript_include_tag(*sources, type: "module-shim")
  end
end
