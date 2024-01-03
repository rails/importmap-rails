# Importmap for Rails

[Import maps](https://github.com/WICG/import-maps) let you import JavaScript modules using logical names that map to versioned/digested files – directly from the browser. So you can [build modern JavaScript applications using JavaScript libraries made for ES modules (ESM) without the need for transpiling or bundling](https://world.hey.com/dhh/modern-web-apps-without-javascript-bundling-or-transpiling-a20f2755). This frees you from needing Webpack, Yarn, npm, or any other part of the JavaScript toolchain. All you need is the asset pipeline that's already included in Rails.

With this approach you'll ship many small JavaScript files instead of one big JavaScript file. Thanks to HTTP/2 that no longer carries a material performance penalty during the initial transport, and in fact offers substantial benefits over the long run due to better caching dynamics. Whereas before any change to any JavaScript file included in your big bundle would invalidate the cache for the whole bundle, now only the cache for that single file is invalidated.

[Import maps are supported natively in all major, modern browsers](https://caniuse.com/?search=importmap). If you need to work with legacy browsers without native support, you can explore using [the shim available](https://github.com/guybedford/es-module-shims).


## Installation

Importmap for Rails is automatically included in Rails 7+ for new applications, but you can also install it manually in existing applications:

1. Run `./bin/bundle add importmap-rails`
2. Run `./bin/rails importmap:install`

Note: In order to use JavaScript from Rails frameworks like Action Cable, Action Text, and Active Storage, you must be running Rails 7.0+. This was the first version that shipped with ESM compatible builds of these libraries.

You can pin those libraries manually by relying on the compiled versions included in Rails like this:

```ruby
pin "@rails/actioncable", to: "actioncable.esm.js"
pin "@rails/activestorage", to: "activestorage.esm.js"
pin "@rails/actiontext", to: "actiontext.esm.js"
pin "trix"
```

## How do importmaps work?

At their core, importmaps are essentially a string substitution for what are referred to as "bare module specifiers". A "bare module specifier" looks like this: `import React from "react"`. This is not compatible with the ES Module loader spec. Instead, to be ESM compatible, you must provide 1 of the 3 following types of specifiers:

- Absolute path:
```js
import React from "/Users/DHH/projects/basecamp/node_modules/react"
```

- Relative path:
```js
import React from "./node_modules/react"
```

- HTTP path:
```js
import React from "https://ga.jspm.io/npm:react@17.0.1/index.js"
```

Importmap-rails provides a clean API for mapping "bare module specifiers" like `"react"` 
to 1 of the 3 viable ways of loading ES Module javascript packages.

For example:

```rb
# config/importmap.rb
pin "react", to: "https://ga.jspm.io/npm:react@17.0.2/index.js"
```

means "everytime you see `import React from "react"` 
change it to `import React from "https://ga.jspm.io/npm:react@17.0.2/index.js"`"

```js
import React from "react" 
// => import React from "https://ga.jspm.io/npm:react@17.0.2/index.js"
```

## Usage

The import map is setup through `Rails.application.importmap` via the configuration in `config/importmap.rb`. This file is automatically reloaded in development upon changes, but note that you must restart the server if you remove pins and need them gone from the rendered importmap or list of preloads.

This import map is inlined in the `<head>` of your application layout using `<%= javascript_importmap_tags %>`, which will setup the JSON configuration inside a `<script type="importmap">` tag. Then the application entrypoint is imported via `<script type="module">import "application"</script>`. That logical entrypoint, `application`, is mapped in the importmap script tag to the file `app/javascript/application.js`.

It's in `app/javascript/application.js` you setup your application by importing any of the modules that have been defined in the import map. You can use the full ESM functionality of importing any particular export of the modules or everything.

It makes sense to use logical names that match the package names used by npm, such that if you later want to start transpiling or bundling your code, you won't have to change any module imports.

### Local modules

If you want to import local js module files from `app/javascript/src` or other sub-folders of `app/javascript` (such as `channels`), you must pin these to be able to import them. You can use `pin_all_from` to pick all files in a specific folder, so you don't have to `pin` each module individually.

```rb
# config/importmap.rb
pin_all_from 'app/javascript/src', under: 'src', to: 'src'
```

The `:to` parameter is only required if you want to change the destination logical import name. If you drop the :to option, you must place the :under option directly after the first parameter.

Allows you to:

```js
// app/javascript/application.js
import { ExampleFunction } from 'src/example_function'
```
Which imports the function from `app/javascript/src/example_function.js`.

Note: Sprockets used to serve assets (albeit without filename digests) it couldn't find from the `app/javascripts` folder with logical relative paths, meaning pinning local files wasn't needed. Propshaft doesn't have this fallback, so when you use Propshaft you have to pin your local modules.

## Using npm packages via JavaScript CDNs

Importmap for Rails downloads and vendors your npm package dependencies via JavaScript CDNs that provide pre-compiled distribution versions.

You can use the `./bin/importmap` command that's added as part of the install to pin, unpin, or update npm packages in your import map. This command uses an API from [JSPM.org](https://jspm.org) to resolve your package dependencies efficiently, and then add the pins to your `config/importmap.rb` file. It can resolve these dependencies from JSPM itself, but also from other CDNs, like [unpkg.com](https://unpkg.com) and [jsdelivr.com](https://www.jsdelivr.com).

```bash
./bin/importmap pin react
Pinning "react" to vendor/react.js via download from https://ga.jspm.io/npm:react@17.0.2/index.js
Pinning "object-assign" to vendor/object-assign.js via download from https://ga.jspm.io/npm:object-assign@4.1.1/index.js
```

This will produce pins in your `config/importmap.rb` like so:

```ruby
pin "react" # https://ga.jspm.io/npm:react@17.0.2/index.js
pin "object-assign" # https://ga.jspm.io/npm:object-assign@4.1.1/index.js
```

The packages are downloaded to `vendor/javascript`, which you can check into your source control, and they'll be available through your application's own asset pipeline serving.

If you later wish to remove a downloaded pin:

```bash
./bin/importmap unpin react
Unpinning and removing "react"
Unpinning and removing "object-assign"
```

## Preloading pinned modules

To avoid the waterfall effect where the browser has to load one file after another before it can get to the deepest nested import, importmap-rails uses [modulepreload links](https://developers.google.com/web/updates/2017/12/modulepreload) by default. If you don't want to preload a dependency, because you want to load it on-demand for efficiency, append `preload: false` to the pin.

Example:

```ruby
# config/importmap.rb
pin "@github/hotkey", to: "@github--hotkey.js" # file lives in vendor/javascript/@github--hotkey.js
pin "md5", preload: false # file lives in vendor/javascript/md5.js

# app/views/layouts/application.html.erb
<%= javascript_importmap_tags %>

# will include the following link before the importmap is setup:
<link rel="modulepreload" href="/assets/javascript/@github--hotkey.js">
...
```

## Composing import maps

By default, Rails loads import map definition from the application's `config/importmap.rb` to the `Importmap::Map` object available at `Rails.application.importmap`.

You can combine multiple import maps by adding paths to additional import map configs to `Rails.application.config.importmap.paths`. For example, appending import maps defined in Rails engines:

```ruby
# my_engine/lib/my_engine/engine.rb

module MyEngine
  class Engine < ::Rails::Engine
    # ...
    initializer "my-engine.importmap", before: "importmap" do |app|
      app.config.importmap.paths << Engine.root.join("config/importmap.rb")
      # ...
    end
  end
end
```

And pinning JavaScript modules from the engine:

```ruby
# my_engine/config/importmap.rb

pin_all_from File.expand_path("../app/assets/javascripts", __dir__)
```


## Selectively importing modules

You can selectively import your javascript modules on specific pages.

Create your javascript in `app/javascript`:

```js
// /app/javascript/checkout.js
// some checkout specific js
```

Pin your js file:

```rb
# config/importmap.rb
# ... other pins...
pin "checkout", preload: false
```

Import your module on the specific page. Note: you'll likely want to use a `content_for` block on the specifc page/partial, then yield it in your layout.

```erb
<% content_for :head do %>
  <%= javascript_import_module_tag "checkout" %>
<% end %>
```

**Important**: The `javascript_import_module_tag` should come after your `javascript_importmap_tags`

```erb
<%= javascript_importmap_tags %>
<%= yield(:head) %>
```


## Include a digest of the import map in your ETag

If you're using [ETags](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag) generated by Rails helpers like `stale?` or `fresh_when`, you need to include the digest of the import map into this calculation. Otherwise your application will return 302 cache responses even when your JavaScript assets have changed. You can avoid this with something like:

```ruby
class ApplicationController < ActionController::Base
  etag { Rails.application.importmap.digest(resolver: helpers) if request.format&.html? }
end
```


## Sweeping the cache in development and test

Generating the import map json and modulepreloads may require resolving hundreds of assets. This can take a while, so these operations are cached, but in development and test, we watch for changes to both `config/importmap.rb` and files in `app/javascript` to clear this cache. This feature can be controlled in an environment configuration file via the boolean `config.importmap.sweep_cache`.

If you're pinning local files from outside of `app/javascript`, you'll need to add them to the cache sweeper configuration or restart your development server upon changes to those external files. For example, here's how you can do it for Rails engine:

```ruby
# my_engine/lib/my_engine/engine.rb

module MyEngine
  class Engine < ::Rails::Engine
    # ...
    initializer "my-engine.importmap", before: "importmap" do |app|
      # ...
      app.config.importmap.cache_sweepers << Engine.root.join("app/assets/javascripts")
    end
  end
end
```

## Checking for outdated or vulnerable packages

Importmap for Rails provides two commands to check your pinned packages:
- `./bin/importmap outdated` checks the NPM registry for new versions
- `./bin/importmap audit` checks the NPM registry for known security issues

## License

Importmap for Rails is released under the [MIT License](https://opensource.org/licenses/MIT).
