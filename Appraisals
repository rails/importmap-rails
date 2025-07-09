appraise "rails_6_1_sprockets" do
  gem "rails", "~> 6.1.0"
end

appraise "rails_7_0_sprockets" do
  gem "rails", "~> 7.0.0"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_7_0_propshaft" do
  gem "rails", "~> 7.0.0"
  gem "propshaft"
end

appraise "rails_7_1_sprockets" do
  gem "rails", "~> 7.1.0"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_7_1_propshaft" do
  gem "rails", "~> 7.1.0"
  gem "propshaft"
end

appraise "rails_8_0_sprockets" do
  gem "rails", "~> 8.0.0"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_8_0_propshaft" do
  gem "rails", "~> 8.0.0"
  gem "propshaft"
end

appraise "rails_main_sprockets" do
  gem "rails", github: "rails/rails", branch: "main"
  remove_gem "propshaft"
  gem "sprockets-rails"
end

appraise "rails_main_propshaft" do
  gem "rails", github: "rails/rails", branch: "main"
  gem "propshaft"
end
