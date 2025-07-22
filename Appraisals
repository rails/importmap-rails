appraise "rails_6.1_sprockets" do
  gem "rails", "~> 6.1.0"
  remove_gem "propshaft"
  gem "logger"
  gem "sqlite3", "~> 1.4"
  gem "bigdecimal"
  gem "mutex_m"
  gem "drb"
end

appraise "rails_7.0_sprockets" do
  gem "rails", github: "rails/rails", branch: "7-0-stable"
  remove_gem "propshaft"
  gem "sprockets-rails"
  gem "sqlite3", "~> 1.4"
end

appraise "rails_7.0_propshaft" do
  gem "rails", github: "rails/rails", branch: "7-0-stable"
  gem "sqlite3", "~> 1.4"
end

appraise "rails_7.1_sprockets" do
  gem "rails", "~> 7.1.0"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_7.1_propshaft" do
  gem "rails", "~> 7.1.0"
end

appraise "rails_7.2_sprockets" do
  gem "rails", "~> 7.2.0"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_7.2_propshaft" do
  gem "rails", "~> 7.2.0"
end

appraise "rails_8.0_sprockets" do
  gem "rails", "~> 8.0.0"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_8.0_propshaft" do
  gem "rails", "~> 8.0.0"
end

appraise "rails_main_sprockets" do
  gem "rails", github: "rails/rails", branch: "main"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_main_propshaft" do
  gem "rails", github: "rails/rails", branch: "main"
end
