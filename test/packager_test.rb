require "test_helper"
require "importmap/packager"

class Importmap::PackagerTest < ActiveSupport::TestCase
  setup { @packager = Importmap::Packager.new }

  test "successful import with mock" do
    response = Class.new do
      def imports
        {
          "react" => "https://ga.jspm.io/npm:react@17.0.2/index.js",
          "object-assign" => "https://ga.jspm.io/npm:object-assign@4.1.1/index.js"
        }
      end

      def code() 200 end
      def dig(*args) imports end
    end.new

    @packager.class.stub(:post, response) do
      assert_equal(response.imports, @packager.import("react@17.0.2"))
    end
  end

  test "missing import with mock" do
    response = Class.new { def code() 404 end }.new

    @packager.class.stub(:post, response) do
      assert_nil @packager.import("missing-package-that-doesnt-exist@17.0.2")
    end
  end

  test "failed request with mock" do
    response = Class.new do
      def code() 500 end
      def throw_exception() raise HTTParty::ResponseError.new({}) end
    end.new

    @packager.class.stub(:post, response) do
      assert_raises(HTTParty::ResponseError) do
        @packager.import("missing-package-that-doesnt-exist@17.0.2")
      end
    end
  end

  end

  end
end
