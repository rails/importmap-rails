pin_all_from "app/assets/javascripts"

pin "md5", to: "https://cdn.skypack.dev/md5", preload: true
pin "not_there", to: "nowhere.js"

map :public do
  pin "md5", to: "https://cdn.skypack.dev/md5", preload: true
  pin "public", to: "public/public.js"
  pin_all_from "app/javascript/public/controllers", to: 'public/controllers', under: "controllers"
end

