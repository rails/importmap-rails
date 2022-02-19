# Importmap for Rails

[Import maps](https://github.com/WICG/import-maps) let you import JavaScript modules using logical names that map to versioned/digested files – directly from the browser. So you can [build modern JavaScript applications using JavaScript libraries made for ES modules (ESM) without the need for transpiling or bundling](https://world.hey.com/dhh/modern-web-apps-without-javascript-bundling-or-transpiling-a20f2755). This frees you from needing Webpack, Yarn, npm, or any other part of the JavaScript toolchain. All you need is the asset pipeline that's already included in Rails.

With this approach you'll ship many small JavaScript files instead of one big JavaScript file. Thanks to HTTP/2 that no longer carries a material performance penalty during the initial transport, and in fact offers substantial benefits over the long run due to better caching dynamics. Whereas before any change to any JavaScript file included in your big bundle would invalidate the cache for the the whole bundle, now only the cache for that single file is invalidated.

There's [native support for import maps in Chrome/Edge 89+](https://caniuse.com/?search=importmap), and [a shim available](https://github.com/guybedford/es-module-shims) for any browser with basic ESM support. So your app will be able to work with all the evergreen browsers.


## Installation

Importmap for Rails is automatically included in Rails 7+ for new applications, but you can also install it manually in existing applications:

1. Add `importmap-rails` to your Gemfile with `gem 'importmap-rails'`
2. Run `./bin/bundle install`
3. Run `./bin/rails importmap:install`

Note: In order to use JavaScript from Rails frameworks like Action Cable, Action Text, and Active Storage, you must be running Rails 7.0+. This was the first version that shipped with ESM compatible builds of these libraries.

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

This import map is inlined in the `<head>` of your application layout using `<%= javascript_importmap_tags %>`, which will setup the JSON configuration inside a `<script type="importmap">` tag. After that, the [es-module-shim](https://github.com/guybedford/es-module-shims) is loaded, and then finally the application entrypoint is imported via `<script type="module">import "application"</script>`. That logical entrypoint, `application`, is mapped in the importmap script tag to the file `app/javascript/application.js`.

It's in `app/javascript/application.js` you setup your application by importing any of the modules that have been defined in the import map. You can use the full ESM functionality of importing any particular export of the modules or everything.

It makes sense to use logical names that match the package names used by npm, such that if you later want to start transpiling or bundling your code, you won't have to change any module imports.


## Using npm packages via JavaScript CDNs

Importmap for Rails is designed to be used with JavaScript CDNs for your npm package dependencies. The CDNs provide pre-compiled distribution versions ready to use, and offer a fast, efficient way of serving them.

You can use the `./bin/importmap` command that's added as part of the install to pin, unpin, or update npm packages in your import map. This command uses an API from [JSPM.org](https://jspm.org) to resolve your package dependencies efficiently, and then add the pins to your `config/importmap.rb` file. It can resolve these dependencies from JSPM itself, but also from other CDNs, like [unpkg.com](https://unpkg.com) and [jsdelivr.com](https://www.jsdelivr.com).

It works like so:

```bash
./bin/importmap pin react react-dom
Pinning "react" to https://ga.jspm.io/npm:react@17.0.2/index.js
Pinning "react-dom" to https://ga.jspm.io/npm:react-dom@17.0.2/index.js
Pinning "object-assign" to https://ga.jspm.io/npm:object-assign@4.1.1/index.js
Pinning "scheduler" to https://ga.jspm.io/npm:scheduler@0.20.2/index.js

./bin/importmap json

{
  "imports": {
    "application": "/assets/application-37f365cbecf1fa2810a8303f4b6571676fa1f9c56c248528bc14ddb857531b95.js",
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

You can also designate a specific version to pin:

```bash
./bin/importmap pin react@17.0.1
Pinning "react" to https://ga.jspm.io/npm:react@17.0.1/index.js
Pinning "object-assign" to https://ga.jspm.io/npm:object-assign@4.1.1/index.js
```

Or even remove pins:

```bash
./bin/importmap unpin react
Unpinning "react"
Unpinning "object-assign"
```

If you pin a package that has already been pinned, it'll be updated inline, along with its dependencies.

You can control the environment of the package for packages with separate "production" (the default) and "development" builds:

```bash
./bin/importmap pin react --env development
Pinning "react" to https://ga.jspm.io/npm:react@17.0.2/dev.index.js
Pinning "object-assign" to https://ga.jspm.io/npm:object-assign@4.1.1/index.js
```

You can also pick an alternative, supported CDN provider when pinning, like `unpkg` or `jsdelivr` (`jspm` is the default):

```bash
./bin/importmap pin react --from jsdelivr
Pinning "react" to https://cdn.jsdelivr.net/npm/react@17.0.2/index.js
```

Remember, though, that if you switch a pin from one provider to another, you may have to clean up dependencies added by the first provider that isn't used by the second provider.

Run `./bin/importmap` to see all options.

Note that this command is merely a convenience wrapper to resolving logical package names to CDN URLs. You can also just lookup the CDN URLs yourself, and then pin those. For example, if you wanted to use Skypack for React, you could just add the following to `config/importmap.rb`:

```ruby
pin "react", to: "https://cdn.skypack.dev/react"
```


## Downloading vendor files from the JavaScript CDN

If you don't want to use a JavaScript CDN in production, you can also download vendored files from the CDN when you're setting up your pins:

```bash
./bin/importmap pin react --download
Pinning "react" to vendor/react.js via download from https://ga.jspm.io/npm:react@17.0.2/index.js
Pinning "object-assign" to vendor/object-assign.js via download from https://ga.jspm.io/npm:object-assign@4.1.1/index.js
```

This will produce pins in your `config/importmap.rb` like so:

```ruby
pin "react" # https://ga.jspm.io/npm:react@17.0.2/index.js
pin "object-assign" # https://ga.jspm.io/npm:object-assign@4.1.1/index.js
```

The packages are downloaded to `vendor/javascript`, which you can check into your source control, and they'll be available through your application's own asset pipeline serving.

If you later wish to remove a downloaded pin, you again pass `--download`:

```bash
./bin/importmap unpin react --download
Unpinning and removing "react"
Unpinning and removing "object-assign"
```

Just like with a normal pin, you can also update a pin by running the `pin --download` command again.


## Preloading pinned modules

To avoid the waterfall effect where the browser has to load one file after another before it can get to the deepest nested import, importmap-rails supports [modulepreload links](https://developers.google.com/web/updates/2017/12/modulepreload). Pinned modules can be preloaded by appending `preload: true` to the pin.

Example:

```ruby
# config/importmap.rb
pin "@github/hotkey", to: "https://ga.jspm.io/npm:@github/hotkey@1.4.4/dist/index.js", preload: true
pin "md5", to: "https://cdn.jsdelivr.net/npm/md5@2.3.0/md5.js"

# app/views/layouts/application.html.erb
<%= javascript_importmap_tags %>

# will include the following link before the importmap is setup:
<link rel="modulepreload" href="https://ga.jspm.io/npm:@github/hotkey@1.4.4/dist/index.js">
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
pin "checkout"
```

Import your module on the specific page. Note: you'll likely want to use a `content_for` block on the specifc page/partial, then yield it in your layout.

```erb
<% content_for :head do %>
  <%= javascript_import_module_tag "checkout" %>
<% end %>
```

**Important**: The `javacript_import_module_tag` should come after your `javascript_importmap_tags`

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

## Expected errors from using the es-module-shim

While import maps are native in Chrome and Edge, they need a shim in other browsers that'll produce a JavaScript console error like `TypeError: Module specifier, 'application' does not start with "/", "./", or "../".`. This error is normal and does not have any user-facing consequences.

In Firefox. when opening the browser console, the asm.js module lexer build will run in unoptimized mode due to the debugger attaching. This gives a warning message `"asm.js type error: Disabled because no suitable wasm compiler is available"` which is as expected. When the console is closed again, the asm.js optimizations are fully applied, and this can even be verified with the console open by disabling the debugger in `about:config` and reloading the page.

## Turning off the shim

Under certain circumstances, like running system tests using chromedriver under CI (which may be resource constrained and trigger errors in certain cases), you may want to explicitly turn off including the shim. You can do this by calling the bulk tag helper with `javascript_importmap_tags("application", shim: false)`. Thus you can pass in something like `shim: !ENV["CI"]`. If you want, and are sure you're not doing any full-page caching, you can also connect this directive to a user agent check (using a gem like `useragent`) to check whether the browser is chrome/edge 89+. But you really shouldn't have to, as the shim is designed to gracefully work with natively compatible drivers.

## License

Importmap for Rails is released under the [MIT License](https://opensource.org/licenses/MIT).
