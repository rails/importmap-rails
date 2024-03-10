require "test_helper"
require "rails/generators/rails/app/app_generator"

class InstallerTest < ActiveSupport::TestCase
  include ActiveSupport::Testing::Isolation

  test "installer task" do
    with_new_rails_app do
      run_command("bin/rails", "importmap:install")

      assert_match %r{<%= javascript_importmap_tags %>.*</head>}m, File.read("app/views/layouts/application.html.erb")
      assert_match "// ", File.read("app/javascript/application.js")
      assert_equal 0, File.size("vendor/javascript/.keep")
      assert_equal File.read("#{__dir__}/../lib/install/config/importmap.rb"), File.read("config/importmap.rb")
      assert_equal File.read("#{__dir__}/../lib/install/bin/importmap"), File.read("bin/importmap")
      assert_equal 0700, File.stat("bin/importmap").mode & 0700

      if defined?(Sprockets)
        manifest = File.read("app/assets/config/manifest.js")
        assert_match "//= link_tree ../../javascript .js", manifest
        assert_match "//= link_tree ../../../vendor/javascript .js", manifest
      end
    end
  end

  test "installer task when no application layout" do
    with_new_rails_app do
      FileUtils.rm("app/views/layouts/application.html.erb")
      out, err = run_command("bin/rails", "importmap:install")
      assert_match "Add <%= javascript_importmap_tags %> within the <head> tag", out
    end
  end

  test "doesn't load rakefile twice" do
    with_new_rails_app do |app_dir|
      rakefile = File.read("#{app_dir}/Rakefile")
      rakefile = "puts \"I've been logged twice!\" \n" + rakefile
      File.write("#{app_dir}/Rakefile", rakefile)

      out, err = run_command("bin/rails", "importmap:install")

      assert_equal 1, out.scan(/I've been logged twice!/).size
    end
  end

  private
    def with_new_rails_app
      # Unset testing dummy app so app generator doesn't get confused in Rails 6.1 and 7.0.
      Rails.app_class = nil
      Rails.application = nil

      Dir.mktmpdir do |tmpdir|
        app_dir = "#{tmpdir}/my_cool_app"

        Rails::Generators::AppGenerator.start([app_dir, "--quiet", "--skip-bundle", "--skip-bootsnap"])

        Dir.chdir(app_dir) do
          gemfile = File.read("Gemfile")
          gemfile.gsub!(/^gem "importmap-rails".*/, "")
          gemfile << %(gem "importmap-rails", path: #{File.expand_path("..", __dir__).inspect}\n)
          if Rails::VERSION::PRE == "alpha"
            gemfile.gsub!(/^gem "rails".*/, "")
            gemfile << %(gem "rails", path: #{Gem.loaded_specs["rails"].full_gem_path.inspect}\n)
          end
          File.write("Gemfile", gemfile)

          run_command("bundle", "install")

          yield(app_dir)
        end
      end
    end

    def run_command(*command)
      Bundler.with_unbundled_env do
        capture_subprocess_io { system(*command, exception: true) }
      end
    end
end
