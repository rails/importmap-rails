require "strscan"

# Every module specifier a JavaScript file names, in source order, with whether
# the browser resolves it while linking the module (:static) or later at
# runtime (:dynamic).
#
# This reads the source with regexes rather than parsing JavaScript. Comments
# are discounted first, since published bundles are full of
# `/** @typedef {import('./slide.js').Slide} */` annotations naming files the
# package never loads. An import spelled out inside a string literal is still
# reported, and a specifier built at runtime is not reported at all.
class Importmap::ImportScanner # :nodoc:
  Import = Struct.new(:specifier, :kind, keyword_init: true)

  # `import("x")` of a string literal, then the static `import "x"` and the
  # `from "x"` that ends every import and re-export form. The lookbehind keeps
  # `loader.import(` and identifiers ending in `import` or `from` out, and the
  # closing `[),]` makes a computed `import(name)` match nothing.
  IMPORT_REGEXP = /
    (?<![\w.$])
    (?:
      import\s*\(\s*(["'])([^"'\n]*)\1\s*[),] |
      (?:from|import)\s*(["'])([^"'\n]*)\3
    )
  /x.freeze
  # What a quoted specifier has to hold to name a module rather than be prose
  # in a string: no whitespace, backtick or `${`, and at least one word character.
  SPECIFIER_REGEXP = /\A(?!.*\$\{)[^\s`]*\w[^\s`]*\z/.freeze

  # Strings and regex literals are consumed whole, so a `//` or `/*` inside one
  # never opens a comment.
  STRING_REGEXP = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/m.freeze
  REGEXP_LITERAL_REGEXP = %r{/(?![*/])(?:[^/\\\n\[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+/[dgimsuvy]*}.freeze
  # Whether a `/` opens a regex literal depends on the token before it. Only the
  # tail of what has been kept is checked, since matching the whole buffer at
  # every slash is quadratic on a large minified file.
  BEFORE_REGEXP_LITERAL_REGEXP =
    /(?:[(,=:\[!&|?{};+\-*%~^<>)\}]|\b(?:return|throw|typeof|case|in|of|do|else|yield|await|delete|void|instanceof|new))\s*\z/.freeze
  REGEXP_LOOKBEHIND_LIMIT = 32
  BLOCK_COMMENT_REGEXP = %r{/\*.*?\*/}m.freeze
  LINE_COMMENT_REGEXP  = %r{//[^\n]*}.freeze

  attr_reader :source

  def initialize(source)
    @source = source.to_s
  end

  def imports
    @imports ||= code.scan(IMPORT_REGEXP).filter_map do |_, dynamic, _, static|
      next unless (dynamic || static).match?(SPECIFIER_REGEXP)

      dynamic ? Import.new(specifier: dynamic, kind: :dynamic) : Import.new(specifier: static, kind: :static)
    end
  end

  private
    def code
      scanner = StringScanner.new(source)
      kept    = +""

      until scanner.eos?
        if scanner.skip(BLOCK_COMMENT_REGEXP) || scanner.skip(LINE_COMMENT_REGEXP)
          next
        elsif (literal = scanner.scan(STRING_REGEXP)) ||
              (regexp_literal_next?(kept, scanner) && (literal = scanner.scan(REGEXP_LITERAL_REGEXP)))
          kept << literal
        else
          kept << scanner.getch
        end
      end

      kept
    end

    def regexp_literal_next?(kept, scanner)
      scanner.match?(%r{/}) &&
        (kept[-REGEXP_LOOKBEHIND_LIMIT..] || kept).match?(BEFORE_REGEXP_LITERAL_REGEXP)
    end
end
