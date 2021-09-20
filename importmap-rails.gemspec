require_relative "lib/importmap/version"

Gem::Specification.new do |spec|
  spec.name        = "importmap-rails"
  spec.version     = Importmap::VERSION
  spec.authors     = [ "David Heinemeier Hansson" ]
  spec.email       = "david@loudthinking.com"
  spec.homepage    = "https://github.com/rails/importmap-rails"
  spec.summary     = "Use ESM with importmap to manage modern JavaScript in Rails without transpiling or bundling."
  spec.license     = "MIT"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/rails/importmap-rails"

  spec.files = Dir["{app,config,db,lib}/**/*", "MIT-LICENSE", "Rakefile", "README.md"]

  spec.add_dependency "rails", ">= 6.0.0"
  spec.add_dependency "listen", "~> 3.7"
end
