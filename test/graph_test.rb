require "test_helper"
require "importmap/graph"

class Importmap::GraphTest < ActiveSupport::TestCase
  test "an entry point reaches what it imports statically, transitively" do
    reachable = reachable_from("application")

    assert_includes reachable, "application"
    assert_includes reachable, "graph/a"
    assert_includes reachable, "graph/b"
  end

  test "a scoped package a reached file imports is reached" do
    assert_includes reachable_from("application"), "@scope/pkg/sub"
  end

  test "a dynamic import is the lazy boundary" do
    reachable = reachable_from("application")

    assert_not_includes reachable, "lazy_chart"
    assert_not_includes reachable, "chart_dep"
  end

  test "a remote pin is reached, and is a leaf" do
    assert_includes reachable_from("application"), "remote_dep"
  end

  test "a pin whose file isn't there is a leaf rather than a raise" do
    reachable = reachable_from("application")

    assert_not_includes reachable, "missing"
  end

  test "an entry point the map doesn't define reaches nothing" do
    assert_empty reachable_from("nobody_pinned_this")
  end

  test "several entry points are walked together" do
    reachable = reachable_from("application", "lazy_chart")

    assert_includes reachable, "graph/a"
    assert_includes reachable, "chart_dep"
  end

  test "a cycle terminates" do
    graph = graph_for do
      pin "cycle_a", to: "graph/cycle_a.js"
      pin "cycle_b", to: "graph/cycle_b.js"
    end

    assert_equal %w[ cycle_a cycle_b ].to_set, graph.reachable_from([ "cycle_a" ])
  end

  test "a relative import resolves against the importing key's own path" do
    graph = graph_for do
      pin_all_from "app/javascript/graph", under: "graph"
    end

    reachable = graph.reachable_from([ "graph/entry" ])

    assert_includes reachable, "graph/a"
    assert_includes reachable, "graph/b"
    assert_not_includes reachable, "graph/lazy_chart"
  end

  test "a subpath of a package pinned as one file reaches that package" do
    graph = graph_for do
      pin "importer", to: "graph/deep_importer.js"
      pin "pkg", to: "graph/b.js"
    end

    assert_includes graph.reachable_from([ "importer" ]), "pkg"
  end

  test "the longest key a subpath sits under wins" do
    graph = graph_for do
      pin "importer", to: "graph/deep_importer.js"
      pin "pkg", to: "graph/b.js"
      pin "pkg/deep", to: "graph/scoped.js"
    end

    reachable = graph.reachable_from([ "importer" ])

    assert_includes reachable, "pkg/deep"
    assert_not_includes reachable, "pkg"
  end

  test "a trailing-slash key covers everything under it" do
    graph = graph_for do
      pin "importer", to: "graph/deep_importer.js"
      pin "pkg/", to: "graph/b.js"
    end

    assert_includes graph.reachable_from([ "importer" ]), "pkg/"
  end

  test "two keys on one file both reach what that file imports" do
    graph = graph_for do
      pin "one", to: "graph/a.js"
      pin "two", to: "graph/a.js"
      pin "graph/b", to: "graph/b.js"
    end

    assert_includes graph.reachable_from([ "one" ]), "graph/b"
    assert_includes graph.reachable_from([ "two" ]), "graph/b"
  end

  private
    def reachable_from(*entry_points)
      graph_for do
        pin "application", to: "graph/entry.js"
        pin "graph/a", to: "graph/a.js"
        pin "graph/b", to: "graph/b.js"
        pin "@scope/pkg/sub", to: "graph/scoped.js"
        pin "lazy_chart", to: "graph/lazy_chart.js"
        pin "chart_dep", to: "graph/chart_dep.js"
        pin "remote_dep", to: "https://cdn.skypack.dev/remote"
        pin "missing", to: "graph/nowhere.js"
      end.reachable_from(entry_points)
    end

    def graph_for(&block)
      Importmap::Graph.new(Importmap::Map.new.draw(&block), roots: Rails.application.config.assets.paths)
    end
end
