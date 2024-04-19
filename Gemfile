source 'https://rubygems.org'
git_source(:github) { |repo| "https://github.com/#{repo}.git" }

# Specify your gem's dependencies in importmap-rails.gemspec.
gemspec

gem "rails", "~> 6.1.0"

gem "sqlite3", "~> 1.4"

group :development do
  gem "appraisal"
end

group :test do
  gem "turbo-rails"
  gem "stimulus-rails"

  gem "byebug"

  gem "rexml"
  gem "capybara"
  gem "selenium-webdriver"
  gem "webdrivers"
end
