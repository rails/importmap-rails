Rails.application.config.importmap.draw do
  pin_all_from "app/assets/javascripts"

  pin "md5", to: "https://cdn.skypack.dev/md5", preload: true
  pin "not_there", to: "nowhere.js"
end
