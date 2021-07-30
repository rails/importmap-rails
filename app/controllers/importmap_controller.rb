class ImportmapController < ActionController::Base
  def show
    render json: Rails.application.config.importmap.paths.to_json
  end
end
