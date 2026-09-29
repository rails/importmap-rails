require "test_helper"
require "importmap/import_scanner"

class Importmap::ImportScannerTest < ActiveSupport::TestCase
  test "a default import" do
    assert_equal [ [ "lit", :static ] ], scan(%(import Lit from "lit";))
  end

  test "a named import" do
    assert_equal [ [ "lit/decorators.js", :static ] ], scan(%(import { customElement } from "lit/decorators.js";))
  end

  test "a namespace import" do
    assert_equal [ [ "lit", :static ] ], scan(%(import * as lit from 'lit'))
  end

  test "a default and named import together" do
    assert_equal [ [ "lit", :static ] ], scan(%(import Lit, { html } from "lit";))
  end

  test "a bare side-effect import" do
    assert_equal [ [ "./polyfill.js", :static ] ], scan(%(import "./polyfill.js";))
  end

  test "a minified import with no spaces" do
    assert_equal [ [ "lit", :static ] ], scan(%(import{html}from"lit";))
  end

  test "a re-export" do
    assert_equal [ [ "./enums.js", :static ] ], scan(%(export { top, bottom } from "./enums.js";))
  end

  test "a star re-export" do
    assert_equal [ [ "@popperjs/core", :static ] ], scan(%(export * from "@popperjs/core";))
  end

  test "a dynamic import of a string literal" do
    assert_equal [ [ "./chunk.js", :dynamic ] ], scan(%(const m = await import("./chunk.js");))
  end

  test "a dynamic import padded with whitespace" do
    assert_equal [ [ "lit", :dynamic ] ], scan(%(import( "lit" )))
  end

  test "a computed dynamic import is ignored" do
    assert_equal [], scan(%(const m = await import(name);))
  end

  test "a template-literal dynamic import is ignored" do
    assert_equal [], scan("const m = await import(`./locales/${lang}.js`);")
  end

  test "imports come back in source order, static and dynamic together" do
    source = <<~JS
      import "./a.js";
      import b from "b";
      const c = await import("./c.js");
      export * from "d";
    JS

    assert_equal [ [ "./a.js", :static ], [ "b", :static ], [ "./c.js", :dynamic ], [ "d", :static ] ], scan(source)
  end

  test "every specifier is reported, including a repeat" do
    assert_equal [ [ "lit", :static ], [ "lit", :static ] ],
      scan(%(import { html } from "lit";\nimport { css } from "lit";))
  end

  test "an import inside a block comment is not read" do
    assert_equal [], scan(%(/** @typedef {import('./slide.js').Slide} Slide */))
  end

  test "an object property named from is not an import" do
    assert_equal [], scan(%({ from: "./a.js", to: "./b.js" }))
  end

  test "a method called import is not an import" do
    assert_equal [], scan(%(loader.import("./a.js"); reimport("./b.js");))
  end

  test "import.meta.url is not an import" do
    assert_equal [], scan(%(const here = import.meta.url;))
  end

  test "an import in a line comment is not read" do
    assert_equal [], scan(%(return htmlLang.split("-")[0] // Extract base locale (e.g., 'en' from 'en-US')))
    assert_equal [], scan(%(// Distinguish "still typing" (too short) from "not a number". This is also))
  end

  test "an import after a line comment on the next line is read" do
    assert_equal [ [ "lit", :static ] ], scan(%(// the templating library\nimport { html } from "lit";))
  end

  test "an import followed by a line comment is read" do
    assert_equal [ [ "lit", :static ] ], scan(%(import { html } from "lit"; // templates))
  end

  test "a URL in a string does not hide the import after it" do
    assert_equal [ [ "lit", :static ] ], scan(%(const cdn = "https://cdn.example.com/";import{html}from"lit";))
  end

  test "a slash pair in a regex literal does not hide the import after it" do
    assert_equal [ [ "lit", :static ] ], scan(%(const re = /\\/\\//g;import{html}from"lit";))
  end

  test "prose in a template literal is not an import" do
    source = 'console.warn(`[TurboPower] The "${e}" CSS class provided in the "from" attribute for the "replace_css_class" action was not found`)'

    assert_equal [], scan(source)
    assert_equal [], scan('console.warn(`[TurboPower] no "from" or "to" class provided for Turbo Streams operation`)')
  end

  test "an import statement built in a template literal is not an import" do
    assert_equal [], scan('const wrapper = `await import("${url}");`;')
    assert_equal [], scan('s(void 0,`import * as m from "`+(this||_global).path+`"; goog.Dependency.callback_("`)')
  end

  test "a string that happens to be the word import is not an import" do
    assert_equal [], scan(%(this.executeType=getStringOption(e.executeType,["import","remerge"])))
  end

  # Documented: this reads the source with regexes rather than parsing it, so
  # an import statement spelled out inside a string literal counts. A pin that
  # exists for it is the cautious direction — the alternative is missing a real
  # import that a bundler wrote next to a string.
  test "an import statement inside a string literal is still reported" do
    assert_equal [ [ "lit", :static ] ], scan(%(const example = "import { html } from 'lit'";))
  end

  private
    def scan(source)
      Importmap::ImportScanner.new(source).imports.map { |import| [ import.specifier, import.kind ] }
    end
end
