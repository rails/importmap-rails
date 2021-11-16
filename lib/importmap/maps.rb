require 'pathname'
require 'importmap/map'

class Importmap::Maps

  attr_reader :maps

  def initialize
    @maps = { 'default' => Importmap::Map.new }
  end

  def default
    @maps['default']
  end

  def [](name)
    @maps[name.to_s]
  end

  def draw(path = nil, &block)
    @maps ={ 'default' => Importmap::Map.new }
    @current_map = @maps['default']
    if path && File.exist?(path)
      begin
        instance_eval(File.read(path), path.to_s)
      rescue Exception => e
        Rails.logger.error "Unable to parse import map from #{path}: #{e.message}"
        raise "Unable to parse import map from #{path}: #{e.message}"
      end
    elsif block_given?
      instance_eval(&block)
    end

    self
  end

  def map(name, entry_point: nil, &block)
    map_name = name.to_s
    # disallow `map` statement inside another map block
    raise "Cannot nest map declarations" if @current_map != @maps['default']
    # do not allow 2 blocks with same name
    raise "Duplicate import maps: '#{map_name}'" if @maps.keys.include?(map_name)
    @maps[map_name] ||= Importmap::Map.new(entry_point: entry_point)
    @current_map = @maps[map_name]
    begin
      @current_map.draw(&block)
    ensure
      @current_map = @maps['default']
    end
  end

  def pin(name, to: nil, preload: false)
    @current_map.pin(name, to: to, preload: preload)
  end

  def pin_all_from(dir, under: nil, to: nil, preload: false)
    @current_map.pin_all_from(dir, under: under, to: to, preload: preload)
  end

  # Returns an instance ActiveSupport::EventedFileUpdateChecker configured to clear the cache of the map
  # when the directories passed on initialization via `watches:` have changes. This is used in development
  # and test to ensure the map caches are reset when javascript files are changed.
  def cache_sweeper(watches: nil)
    if watches
      @cache_sweeper =
        Rails.application.config.file_watcher.new([], Array(watches).collect { |dir| [ dir.to_s, "js"] }.to_h) do
          clear_cache
        end
    else
      @cache_sweeper
    end
  end

  def clear_cache
    @maps.values.each(&:clear_cache)
  end

end