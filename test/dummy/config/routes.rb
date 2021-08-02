Rails.application.routes.draw do
  mount Importmap::Engine => "/importmap"
end
