Rails.application.routes.draw do
  get "importmap" => "importmap#show", as: :importmap
end
