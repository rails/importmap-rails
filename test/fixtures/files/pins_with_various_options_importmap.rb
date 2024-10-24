pin_all_from "app/assets/javascripts"

pin "md5", to: "https://cdn.skypack.dev/md5", preload: true # 1.0.2
pin "not_there", to: "nowhere.js", preload: false # 1.9.1
pin "some_file" # 0.2.1
pin "another_file",to:'another_file.js' # @0.0.16
pin "random", random_option: "foobar", hello: "world" # 7.7.7
pin "javascript/typescript", preload: true, to: "https://cdn.skypack.dev/typescript" # 0.0.0
