# Importmap for Rails

[Import maps](https://github.com/WICG/import-maps) let you import JavaScript modules using logical names that map to versioned/digested files – directly from the browser. So you can build modern JavaScript applications using JavaScript libraries made for ESM without the need for transpiling or bundling. Without the need for such preprocessing, you can build advanced Rails applications without Webpack, Yarn, NPM, or any other part of the JavaScript toolchain. All you need is the asset pipeline that's already included in Rails.

With this approach you'll ship many small JavaScript files instead of one big JavaScript file. Thanks to HTTP2 that no longer carries a material performance penalty during the initial transport, and in fact offers substantial benefits over the long run due to better caching dynamics. Whereas before, any change to any JavaScript file included in your big bundle would invalidate the cache for the the whole bundle, now only the cache for that single file is invalidated.

There's [native support for import maps in Chrome/Edge 89+](https://caniuse.com/?search=importmap), and [a shim available](https://github.com/guybedford/es-module-shims) for any browser with basic ESM support. So your app will be able to work with all the evergreen browsers.


## Installation

1. Add `importmap-rails` to your Gemfile with `gem 'importmap-rails'` (make sure it's included before any gems using it!)
2. Run `./bin/bundle install`
3. Run `./bin/rails importmap:install`

By default, all the files in `app/assets/javascripts` and the three major Rails JavaScript libraries are already mapped. You can add more mappings in `config/importmap.rb`.

Note: In order to use JavaScript from Rails frameworks like Action Cable, Action Text, and Active Storage, you must be running Rails 7.0+. This was the first version that shipped with ESM compatible builds of these libraries.


## Usage

The import map is configured programmatically through the `Rails.application.config.importmap` assignment, which by default is setup in `config/importmap.rb` after running the installer. This file is automatically reloaded in development upon changes, but note that you must restart the server if you remove pins and need them gone from the rendered importmap or list of preloads.

This programmatically configured import map is inlined in the `<head>` of your application layout using `<%= javascript_importmap_tags %>`, which will setup the JSON configuration inside a `<script type="importmap">` tag. After that, the [es-module-shim](https://github.com/guybedford/es-module-shims) is loaded, and then finally the application entrypoint is imported via `<script type="module">import "application"</script>`. That logical entrypoint, `application`, is mapped in the importmap script tag to the file `app/javascript/application.js`, which is copied and digested by the asset pipeline.

It's in `app/javascript/application.js` you setup your application by importing any of the modules that have been defined in the import map. You can use the full ESM functionality of importing any particular export of the modules or everything.

It makes sense to use logical names that match the package names used by NPM, such that if you later want to start transpiling or bundling your code, you'll not have to change any module imports.


## Using node modules via JavaScript CDNs

Importmap for Rails is designed to be used with JavaScript CDNs for your node package dependencies. The CDNs provide pre-compiled distribution versions ready to use, and offer a fast, efficient way of serving them.

You can use the `./bin/importmap` command that's added as part of the install to pin additional packages to your import map. This command uses an API from [JSPM.org](https://jspm.org) to resolve your package dependencies most efficiently, and then add the pins to your `config/importmap.rb` file. It can resolve these dependencies from JSPM itself, but also from other CDNs, like [unpkg.com](https://unpkg.com), [jsdelivr.com](https://www.jsdelivr.com), [skypack.dev](https://www.skypack.dev), etc.

It works like so:

```bash
./bin/importmap pin react react-dom

Pinned 'react' to https://ga.jspm.io/npm:react@17.0.2/index.js
Pinned 'react-dom' to https://ga.jspm.io/npm:react-dom@17.0.2/index.js
Pinned 'object-assign' to https://ga.jspm.io/npm:object-assign@4.1.1/index.js
Pinned 'scheduler' to https://ga.jspm.io/npm:scheduler@0.20.2/index.js

./bin/importmap json

{
  "imports": {
    "application": "/application.js",
    "react": "https://ga.jspm.io/npm:react@17.0.2/index.js",
    "react-dom": "https://ga.jspm.io/npm:react-dom@17.0.2/index.js",
    "object-assign": "https://ga.jspm.io/npm:object-assign@4.1.1/index.js",
    "scheduler": "https://ga.jspm.io/npm:scheduler@0.20.2/index.js"
  }
}
```

As you can see, the two packages react and react-dom resolve to a total of four dependencies, when resolved via the jspm default.

Now you can use these in your application.js entrypoint like you would any other module:

```js
import React from "react"
import ReactDOM from "react-dom"
```

Run `./bin/importmap` to see more options.


## Preloading pinned modules

To mitigate the waterfall effect where the browser has to load one file after another before it can get to the deepest nested import, we use [modulepreload links](https://developers.google.com/web/updates/2017/12/modulepreload). Pinned modules are preloaded by default, but you can turn this off with `preload: false`.

Example:

```ruby
# config/importmap.rb
pin "@github/hotkey", to: "https://ga.jspm.io/npm:@github/hotkey@1.4.4/dist/index.js"
pin "md5", to: "https://cdn.jsdelivr.net/npm/md5@2.3.0/md5.js", preload: false

# app/views/layouts/application.html.erb
<%= javascript_importmap_tags %> 

# will include the following link before the importmap is setup:
<link rel="modulepreload" href="https://ga.jspm.io/npm:@github/hotkey@1.4.4/dist/index.js">
...
```


## Caching the import map and preload modules

The import map should be cached in production, and is so by default via the `config.importmap.cached` option that will be set to the same value as `config.action_controller.perform_caching`, unless explicitly set differently.


## Expected errors from using the es-module-shim

While import maps are native in Chrome and Edge, they need a shim in other browsers that'll produce a JavaScript console error like `TypeError: Module specifier, 'application' does not start with "/", "./", or "../".`. This error is normal and does not have any user-facing consequences.


## License

Importmap for Rails is released under the [MIT License](https://opensource.org/licenses/MIT).
