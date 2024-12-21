module Importmap::Freshness
  def stale_when_importmap_changes
    etag { Rails.application.importmap.digest(resolver: helpers) if request.format&.html? }
  end
end
