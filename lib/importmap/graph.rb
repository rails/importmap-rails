require "pathname"
require "set"
require "importmap/import_scanner"

# Which pins an entry point actually reaches through static imports, read out
# of the files the map already lists. Used by
# `config.importmap.preload_strategy = :reachable` so that `preload: true` only
# preloads what the page will load while linking the entry point.
#
# A dynamic `import()` is the app saying "later", so it is where the walk stops:
# preloading its target would undo the deferral the app asked for.
#
# Nothing here reaches the network; the files are the ones the asset pipeline
# already serves.
class Importmap::Graph # :nodoc:
  REMOTE_PATH_REGEXP = %r{\A(?:[a-zA-Z][a-zA-Z0-9+\-.]*:)?//}.freeze

  def initialize(map, roots: [])
    @map   = map
    @roots = Array(roots).map { |root| Pathname.new(root) }
  end

  # The keys reachable from +entry_points+, the entry points included. An entry
  # point the map doesn't define, a pin whose file isn't on any asset path and a
  # remote pin are all leaves.
  def reachable_from(entry_points)
    queue   = Array(entry_points).select { |key| entries.key?(key) }
    reached = Set.new(queue)

    while (key = queue.shift)
      edges_from(key).each { |target| queue << target if reached.add?(target) }
    end

    reached
  end

  private
    def entries
      @entries ||= @map.each_expanded_package.to_h
    end

    # Two keys can name one file; the first one drawn wins.
    def keys_by_path
      @keys_by_path ||= entries.each_with_object({}) { |(key, mapping), keys| keys[mapping.path] ||= key }
    end

    def edges_from(key)
      @edges ||= {}
      @edges[key] ||= compute_edges(entries[key])
    end

    def compute_edges(mapping)
      file = file_for(mapping.path)
      return [] unless file

      Importmap::ImportScanner.new(source_of(file)).imports.filter_map { |import|
        key_for(import.specifier, mapping.path) if import.kind == :static
      }.uniq
    end

    def file_for(path)
      return if path.match?(REMOTE_PATH_REGEXP)

      @roots.lazy.map { |root| root.join(path) }.find(&:file?)
    end

    # Scrubbed, so one vendored file with invalid UTF-8 can't take a page's
    # preloads down with it.
    def source_of(file)
      File.binread(file).force_encoding(Encoding::UTF_8).scrub
    end

    # A relative specifier resolves against the importing key's own path, as
    # the browser resolves it against the importing module's URL. Anything else
    # names a key, a path a key maps to, or a subpath of a pinned package.
    def key_for(specifier, importer_path)
      return if specifier.empty?

      if specifier.start_with?("./", "../")
        keys_by_path[resolved_path(specifier, importer_path)]
      else
        exact_key(specifier) || enclosing_key(specifier)
      end
    end

    def resolved_path(specifier, importer_path)
      Pathname.new(importer_path).dirname.join(specifier.sub(/[?#].*\z/, "")).cleanpath.to_s
    rescue ArgumentError
      nil
    end

    def exact_key(specifier)
      entries.key?(specifier) ? specifier : keys_by_path[specifier]
    end

    # `pin "foo/"` covers everything under it, and a subpath of a package pinned
    # as one file counts as reaching that package: one preload too many costs a
    # request, one too few costs the waterfall.
    def enclosing_key(specifier)
      entries.keys.select { |key|
        key.end_with?("/") ? specifier.start_with?(key) : specifier.start_with?("#{key}/")
      }.max_by(&:length)
    end
end
